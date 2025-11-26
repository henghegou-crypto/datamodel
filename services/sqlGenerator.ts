import { EntityNode, Relationship, DatabaseType, ModelType } from '../types';

export const generateDDL = (
  entities: EntityNode[],
  relationships: Relationship[],
  dbType: DatabaseType,
  modelType: ModelType
): string => {
  let sql = `-- Generated SQL for ${modelType} Model\n`;
  sql += `-- Target Database: ${dbType}\n`;
  sql += `-- Generated at: ${new Date().toISOString()}\n\n`;

  // Helper to map generic types to DB specific types
  const mapType = (type: string) => {
    const t = type.toLowerCase();
    
    // Simple heuristic type mapping
    const isString = t.includes('string') || t.includes('varchar') || t.includes('text');
    const isNumber = t.includes('int') || t.includes('number') || t.includes('decimal') || t.includes('float');
    const isDate = t.includes('date') || t.includes('time');
    const isBoolean = t.includes('bool');

    if (dbType === DatabaseType.POSTGRESQL || dbType === DatabaseType.GAUSSDB) {
      if (isString) return t.includes('text') ? 'TEXT' : 'VARCHAR(255)';
      if (isNumber) return t.includes('decimal') ? 'DECIMAL(10,2)' : 'INTEGER';
      if (isDate) return 'TIMESTAMP';
      if (isBoolean) return 'BOOLEAN';
    } 
    else if (dbType === DatabaseType.ORACLE || dbType === DatabaseType.DAMENG || dbType === DatabaseType.KINGBASE) {
      if (isString) return 'VARCHAR2(255)';
      if (isNumber) return 'NUMBER';
      if (isDate) return 'DATE'; // Oracle DATE includes time, or TIMESTAMP
      if (isBoolean) return 'NUMBER(1)';
    }
    else if (dbType === DatabaseType.HIVE) {
      if (isString) return 'STRING';
      if (isNumber) return t.includes('decimal') ? 'DECIMAL(10,2)' : 'INT';
      if (isDate) return 'TIMESTAMP';
      if (isBoolean) return 'BOOLEAN';
    }
    // MySQL and Default
    else {
      if (isString) return t.includes('text') ? 'TEXT' : 'VARCHAR(255)';
      if (isNumber) return t.includes('decimal') ? 'DECIMAL(10,2)' : 'INT';
      if (isDate) return 'DATETIME';
      if (isBoolean) return 'TINYINT(1)';
    }
    
    return type; // Fallback to what user entered
  };

  // 1. Create Tables
  entities.forEach(entity => {
    sql += `CREATE TABLE ${formatName(entity.name, dbType)} (\n`;
    
    const lines: string[] = [];
    
    // Columns
    entity.attributes.forEach(attr => {
      let line = `  ${formatName(attr.name, dbType)} ${mapType(attr.dataType)}`;
      
      if (attr.isPrimaryKey) {
        if (dbType === DatabaseType.HIVE) {
            line += ' COMMENT \'Primary Key\'';
        } else {
            line += ' PRIMARY KEY';
        }
      } else if (!attr.isNullable) {
        if (dbType !== DatabaseType.HIVE) {
            line += ' NOT NULL';
        }
      }

      if (attr.comment && dbType === DatabaseType.HIVE) {
          line += ` COMMENT '${attr.comment}'`;
      }
      
      lines.push(line);
    });

    sql += lines.join(',\n');
    
    // Table Properties
    if (dbType === DatabaseType.HIVE) {
        sql += `\n) COMMENT '${entity.chineseName || entity.name}' STORED AS ORC;\n\n`;
    } else if (dbType === DatabaseType.MYSQL) {
        sql += `\n) COMMENT='${entity.chineseName || entity.name}';\n\n`;
    } else if (dbType === DatabaseType.ORACLE || dbType === DatabaseType.DAMENG) {
        sql += `\n);\n`;
        if (entity.chineseName) {
           sql += `COMMENT ON TABLE ${formatName(entity.name, dbType)} IS '${entity.chineseName}';\n`;
        }
        entity.attributes.forEach(attr => {
            if (attr.comment) {
                sql += `COMMENT ON COLUMN ${formatName(entity.name, dbType)}.${formatName(attr.name, dbType)} IS '${attr.comment}';\n`;
            }
        });
        sql += `\n`;
    } else {
        sql += `\n);\n\n`;
    }
  });

  // 2. Add Foreign Keys (Skip for Hive/NoSQL or Conceptual)
  if (modelType !== ModelType.CONCEPTUAL && dbType !== DatabaseType.HIVE) {
    relationships.forEach((rel, index) => {
        const source = entities.find(e => e.id === rel.sourceId);
        const target = entities.find(e => e.id === rel.targetId);
        
        if (source && target) {
        const fkName = `fk_${target.name}_${source.name}_${index}`;
        sql += `-- Add FK for ${source.name} -> ${target.name}\n`;
        sql += `ALTER TABLE ${formatName(target.name, dbType)} ADD CONSTRAINT ${fkName} \n`;
        sql += `  FOREIGN KEY (source_id_placeholder) REFERENCES ${formatName(source.name, dbType)} (id);\n\n`;
        }
    });
  }

  return sql;
};

const formatName = (name: string, dbType: DatabaseType) => {
  const clean = name.replace(/\s+/g, '_');
  
  switch (dbType) {
      case DatabaseType.POSTGRESQL:
      case DatabaseType.GAUSSDB:
      case DatabaseType.ORACLE:
      case DatabaseType.DAMENG:
      case DatabaseType.KINGBASE:
          return `"${clean}"`; // Oracle often uppercases, but quotes preserve case.
      case DatabaseType.MYSQL:
      case DatabaseType.HIVE:
          return `\`${clean}\``;
      case DatabaseType.SQLSERVER:
          return `[${clean}]`;
      default:
          return clean;
  }
};