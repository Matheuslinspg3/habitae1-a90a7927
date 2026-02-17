export interface ParsedRow {
  [key: string]: string;
}

export interface CSVParseResult {
  headers: string[];
  rows: ParsedRow[];
  delimiter: string;
  totalRows: number;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSV(text: string): CSVParseResult {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('O arquivo CSV deve ter pelo menos um cabeçalho e uma linha de dados');
  }

  const delimiter = detectDelimiter(text);
  const headers = parseLine(lines[0], delimiter).map(h =>
    h.replace(/^"|"$/g, '').trim()
  );

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter);
    if (values.every(v => !v.trim())) continue;

    const row: ParsedRow = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] || '').replace(/^"|"$/g, '').trim();
    });
    rows.push(row);
  }

  return { headers, rows, delimiter, totalRows: rows.length };
}

export function generateTemplateCSV(): string {
  const headers = ['Nome', 'Email', 'Telefone', 'Origem', 'Valor Estimado', 'Observações', 'Corretor', 'Tipo Imóvel', 'Bairro', 'Cidade'];
  const sample = ['João Silva', 'joao@email.com', '(11) 99999-0000', 'Facebook Ads', '500000', 'Interessado em 3 quartos', 'Maria Santos', 'Apartamento', 'Centro', 'São Paulo'];
  return [headers.join(';'), sample.join(';')].join('\n');
}
