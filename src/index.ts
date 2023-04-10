import path from 'path';
import { promises as fsp } from "fs";
import glob from "glob";
import { uniqBy } from "lodash";
import Papa from 'papaparse';

// 1. Find all relevant files and read them
// 2. Extract the entries from individual files
// 3. Merge all entries
// 4. Export the file containing all entries

/**
 * Example (as of 2022-01-16):
 * 
 * ```
 * {
 *   objectid: 433,
 *   evidencnecislovrtupomocne: 'L-33-12-A-c/136',
 *   evidencnecislovrtu: 136,
 *   povodneevidencnecislo: 'P-6',
 *   mapa: 'L-33-12-A-c',
 *   povodie: 'Dunaj',
 *   hydrorajon: '52 Q',
 *   lokalita: 'Gabčíkovo',
 *   prevadzajucaorganizacia: null,
 *   suradnicax: 1310246.4,
 *   suradnicay: 538640.31,
 *   suradnicazteren: 112.87,
 *   suradnicazpazenie: 113.49,
 *   hlbkavrtu: 10,
 *   typvrtu: 4,
 *   typvrtupopis: 'monitorovací vrt',
 *   archivnecislospravy: '93548',
 *   archivnecisloretazec: null,
 *   utajeniespravydo: null,
 *   spracovaldatum: 1477267200000,
 *   poznamka: null,
 *   pdf: '12Ac136.pdf'
 * }
 * ```
 */
interface Entry {
  /** Example: 433 */
  objectid: number;
  /** Example: 'L-33-12-A-c/136' */
  evidencnecislovrtupomocne: string;
  /** Example: 136 */
  evidencnecislovrtu: number;
  /** Example: 'P-6' */
  povodneevidencnecislo: string;
  /** Example: 'L-33-12-A-c' */
  mapa: string;
  /** Example: 'Dunaj' */
  povodie: string;
  /** Example: '52 Q' */
  hydrorajon: string;
  /** Example: 'Gabčíkovo' */
  lokalita: string;
  /** Unknown value */
  prevadzajucaorganizacia: string | null;
  /** Example: 1310246.4 */
  suradnicax: number;
  /** Example: 538640.31 */
  suradnicay: number;
  /** Example: 112.87 */
  suradnicazteren: number;
  /** Example: 113.49 */
  suradnicazpazenie: number;
  /** Example: 10 */
  hlbkavrtu: number;
  /** Example: 4 */
  typvrtu: number;
  /** Example: 'monitorovací vrt' */
  typvrtupopis: string;
  /** Example: '93548' */
  archivnecislospravy: string | null;
  /** Unknown value */
  archivnecisloretazec: string | null;
  /** Unknown value */
  utajeniespravydo: any;
  /** Example: '1477267200000' */
  spracovaldatum: number;
  /** Unknown value */
  poznamka: any;
  /** Example: '12Ac136.pdf' */
  pdf: string;
}

/**
 * Find all relevant files and read them
 */
const readFiles = async (pattern: string): Promise<string[]> => {
  return new Promise<string[]>((res, rej) => {
    glob(pattern, (err, filenames) => {
      if (err) {
        rej(err);
        return;
      }
      res(filenames ?? []);
    });
  });
};

const loadFile = async (filename: string) => {
  const content = await fsp.readFile(filename, "utf-8");
  try {
    return JSON.parse(content);
  } catch (err) {
    return {};
  }
};

const extractEntries = (fileContent: any): Entry[] => {
  return (fileContent.features ?? [])
    .map((feature: any) => feature?.attributes ?? null)
    .filter(Boolean);
};

const processEntryFiles = async (filenames: string[]): Promise<Entry[]> => {
  const entriesPerFiles = await Promise.all(
    filenames.map(async (filename) => {
      const fileData = await loadFile(filename);
      const fileEntries = extractEntries(fileData);
      return fileEntries;
    }),
  );

  const entries = uniqBy(
    entriesPerFiles.flatMap(fileEntries => fileEntries),
    (entry) => entry.objectid,
  );

  return entries;
};

type ExportFormats = 'json' | 'csv';

const saveEntries = async (entries: Entry[], options?: {outputFile?: string; format?: ExportFormats}): Promise<void> => {
  const {outputFile = './output.json', format = 'json'} = options ?? {};
  const outputDir = path.dirname(outputFile);
  console.log(`Creating parent directory "${outputDir}"`)
  await fsp.mkdir(outputDir, {recursive: true});
  console.log(`Writing ${entries.length} entries to file "${outputFile}"`);
  
  const formatSerializers: Record<ExportFormats, (entries: Entry[]) => string> = {
    json: (entries) => JSON.stringify(entries, null, 2),
    csv: (entries) => Papa.unparse(entries),
  }

  const serializer = formatSerializers[format];
  if (!serializer) {
    throw Error(`Invalid export format "${format}"`);
  }

  const fileContent = serializer(entries);
  await fsp.writeFile(
    outputFile,
    fileContent,
    'utf-8',
  );
};

const main = async () => {
  const files = await readFiles("input/*.json");
  const entries = await processEntryFiles(files);
  await saveEntries(entries, {outputFile: './output/geology-sk.csv', format: 'csv'});
};

if (require.main === module) {
  main();
}
