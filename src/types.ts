export type CellValue = string | number | boolean | null;

export type RowSnapshot = Record<string, CellValue>;

export type SchemaSummary = {
  name: string;
  count: number;
  properties: string[];
};

export type PageRequest = {
  requestId: number;
  schemaName: string;
  query: string;
  page: number;
};

export type PageResult = PageRequest & {
  total?: number;
  rows?: RowSnapshot[];
  error?: string;
};

export type EventMap = {
  'realm:schemas': SchemaSummary[];
  'realm:request-schemas': undefined;
  'realm:request-page': PageRequest;
  'realm:page': PageResult;
};
