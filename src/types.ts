export type PrimitiveCellValue = string | number | boolean | null;

export type QueryArgument = {
  property: string;
  value: string | number;
};

export type LinkTarget = {
  label: string;
  schemaName: string;
  query: string;
  argument: QueryArgument;
};

export type LinkedCellValue = {
  kind: 'links';
  collection: boolean;
  links: LinkTarget[];
  remaining: number;
};

export type CellValue = PrimitiveCellValue | LinkedCellValue;

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
  queryArgument?: QueryArgument;
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
