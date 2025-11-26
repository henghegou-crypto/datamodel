
export enum ModelType {
  CONCEPTUAL = 'Conceptual',
  LOGICAL = 'Logical',
  PHYSICAL = 'Physical',
  DIMENSIONAL = 'Dimensional' // Changed from Relational
}

export enum Cardinality {
  ONE_TO_ONE = '1:1',
  ONE_TO_MANY = '1:N',
  MANY_TO_MANY = 'M:N'
}

export type LineStyle = 'straight' | 'curve' | 'step';

export type MarkerType = 'none' | 'arrow' | 'diamond' | 'circle' | 'crowfoot' | 'one';

export type EntityShape = 'rectangle' | 'circle' | 'diamond';

export type TableType = 'fact' | 'dimension' | 'other';

export enum DatabaseType {
  POSTGRESQL = 'PostgreSQL',
  MYSQL = 'MySQL',
  SQLSERVER = 'SQL Server',
  ORACLE = 'Oracle',
  HIVE = 'Hive',
  DAMENG = 'Dameng', // 达梦
  KINGBASE = 'Kingbase', // 人大金仓
  GAUSSDB = 'GaussDB' // 高斯
}

export interface Attribute {
  id: string;
  name: string;
  dataType: string;
  dataStandard?: string; // Code of the standard
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isNullable?: boolean;
  comment?: string;
}

export interface DbIndex {
  id: string;
  name: string;
  isUnique: boolean;
  columns: string[]; // Attribute IDs
  type: 'BTREE' | 'HASH' | 'BITMAP' | 'GIN' | 'GIST';
}

export interface DbPartition {
  id: string;
  name: string;
  type: 'RANGE' | 'LIST' | 'HASH';
  expression: string; // e.g., "PARTITION BY RANGE (date_column)"
}

export interface EntityNode {
  id: string;
  name: string; // Entity Name or Table Name
  chineseName?: string;
  layer?: string; // ODS, DWD, etc.
  subject?: string; // Theme/Domain
  x: number;
  y: number;
  width?: number; // Custom Width
  height?: number; // Custom Height
  attributes: Attribute[];
  indexes?: DbIndex[]; // Physical Model specific
  partitions?: DbPartition[]; // Physical Model specific
  type: 'entity' | 'table' | 'view';
  tableType?: TableType; // For Dimensional Modeling
  shape?: EntityShape; // Visual shape for conceptual models
  color?: string; // Custom color (hex or tailwind class hint)
  collapsed?: boolean; // For collapsing attributes
  showFullAttributes?: boolean; // Toggle for expanding
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  cardinality: Cardinality;
  label?: string;
  lineStyle: LineStyle;
  sourceMarker?: MarkerType;
  targetMarker?: MarkerType;
}

export interface ModelVersion {
  id: string;
  timestamp: number;
  name: string;
  data: {
    entities: EntityNode[];
    relationships: Relationship[];
  };
}

export interface DataModel {
  id: string;
  name: string;
  description: string;
  type: ModelType;
  entities: EntityNode[];
  relationships: Relationship[];
  versions: ModelVersion[];
  createdAt: number;
  updatedAt: number;
}
