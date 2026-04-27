/**
 * Generates README.md from README.template.md + source code.
 *
 * Replaces markers in the template:
 *   <!-- GEN:TYPES -->...<!-- /GEN:TYPES -->   → contents of src/types.ts
 *   <!-- GEN:API -->...<!-- /GEN:API -->         → method signatures + JSDoc from src/client.ts
 *
 * Run: npx tsx scripts/generate-readme.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const template = readFileSync(join(root, 'scripts', 'readme-template.md'), 'utf-8');
const typesSource = readFileSync(join(root, 'src/types.ts'), 'utf-8');
const clientSource = readFileSync(join(root, 'src/client.ts'), 'utf-8');

// --- Extract types (strip import lines, trim) ---
const typesBlock = typesSource
  .split('\n')
  .filter(line => !line.startsWith('import '))
  .join('\n')
  .trim();

// --- Extract API from client.ts ---
//
// Strategy: iterate over every JSDoc block in the source. For each one,
// look at the immediately following code token. If it's an identifier
// followed by `:` (typed property), `,` (shorthand property), or `(`
// (method shorthand), and the identifier is in our public-API lookup,
// emit a Markdown entry for it.
//
// New public API members must be registered in `signatureLookup` below.

const signatureLookup: Record<string, string> = {
  getAuthorizeUrl: '(options?: AuthorizeOptions) => string',
  popup: '(options?: PopupOptions) => Promise<PopupResult>',
  exchangeCode: '(code: string) => Promise<TokenResponse>',
  call: '(options: ProxyCallOptions) => Promise<ProxyResponse>',
  proxyUrl: '(provider: Provider) => string',
  baseUrl: 'string',
  proxyBase: 'string',
};

function extractApi(source: string): string {
  const methods: string[] = [];

  const jsdocRegex = /\/\*\*([\s\S]*?)\*\//g;
  let match: RegExpExecArray | null;

  while ((match = jsdocRegex.exec(source)) !== null) {
    const rawDoc = match[1]!;
    const tail = source.slice(match.index + match[0].length);

    // The identifier must be the immediate next token (whitespace only
    // between `*/` and the name). Stop on `:`, `,`, or `(`.
    const nameMatch = tail.match(/^\s*(\w+)\s*[:,(]/);
    if (!nameMatch) continue;

    const name = nameMatch[1]!;
    const signature = signatureLookup[name];
    if (!signature) continue;

    // Clean JSDoc: strip leading "* ", drop fenced code examples, then
    // take the first paragraph (consecutive non-empty lines joined into
    // one) as the description.
    const paragraph: string[] = [];
    let inCodeBlock = false;
    let paragraphClosed = false;
    for (const line of rawDoc.split('\n')) {
      const cleaned = line.replace(/^\s*\*\s?/, '').trim();
      if (cleaned.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (paragraph.length > 0) paragraphClosed = true;
        continue;
      }
      if (inCodeBlock) continue;
      if (cleaned === '') {
        if (paragraph.length > 0) paragraphClosed = true;
        continue;
      }
      if (paragraphClosed) break;
      paragraph.push(cleaned);
    }
    const description = paragraph.join(' ');

    if (signature.startsWith('(')) {
      methods.push(`### \`.${name}${signature}\`\n\n${description}`);
    } else {
      methods.push(`### \`.${name}\`: \`${signature}\`\n\n${description}`);
    }
  }

  return methods.join('\n\n');
}

const apiBlock = extractApi(clientSource);

// --- Inject into template ---
function inject(content: string, tag: string, replacement: string): string {
  const regex = new RegExp(
    `(<!-- GEN:${tag} -->)([\\s\\S]*?)(<!-- /GEN:${tag} -->)`,
    'g',
  );
  return content.replace(regex, `$1\n${replacement}\n$3`);
}

let readme = template;
readme = inject(readme, 'TYPES', '```typescript\n' + typesBlock + '\n```');
readme = inject(readme, 'API', apiBlock);

writeFileSync(join(root, 'README.md'), readme);

const lineCount = readme.split('\n').length;
console.log(`Generated README.md (${lineCount} lines)`);
