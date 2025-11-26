import { DataModel, ModelType, Cardinality } from '../types';

// Safe ID generator
export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {}
  }
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
};

// Initial Mock Data
const MOCK_MODELS: DataModel[] = [
  {
    id: '1',
    name: 'E-Commerce Core',
    description: 'Core logic for shop',
    type: ModelType.LOGICAL,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    entities: [
      { 
        id: 'e1', 
        name: 'User', 
        chineseName: '用户表',
        layer: 'ODS',
        subject: 'Customer',
        type: 'entity', 
        collapsed: false,
        x: 100, 
        y: 100, 
        attributes: [{ id: 'a1', name: 'email', dataType: 'String', isPrimaryKey: true, isNullable: false }] 
      },
      { 
        id: 'e2', 
        name: 'Order', 
        chineseName: '订单表',
        layer: 'DWD',
        subject: 'Order',
        type: 'entity', 
        collapsed: false,
        x: 500, 
        y: 150, 
        attributes: [{ id: 'a2', name: 'order_id', dataType: 'UUID', isPrimaryKey: true, isNullable: false }, { id: 'a3', name: 'total', dataType: 'Money', isNullable: true }] 
      }
    ],
    relationships: [
      { id: 'r1', sourceId: 'e1', targetId: 'e2', cardinality: Cardinality.ONE_TO_MANY, lineStyle: 'step', sourceMarker: 'one', targetMarker: 'crowfoot' }
    ],
    versions: []
  },
  {
    id: '2',
    name: 'Business Concept',
    description: 'High level business objects',
    type: ModelType.CONCEPTUAL,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    entities: [
      { 
        id: 'c1', 
        name: 'Customer', 
        chineseName: '客户',
        type: 'entity', 
        shape: 'circle',
        x: 150, 
        y: 100, 
        attributes: [] 
      },
      { 
        id: 'c2', 
        name: 'Purchase', 
        chineseName: '购买行为',
        type: 'entity', 
        shape: 'diamond',
        x: 450, 
        y: 100, 
        attributes: [] 
      },
       { 
        id: 'c3', 
        name: 'Product', 
        chineseName: '商品',
        type: 'entity', 
        shape: 'rectangle',
        x: 750, 
        y: 100, 
        attributes: [] 
      }
    ],
    relationships: [
        { id: 'r2', sourceId: 'c1', targetId: 'c2', cardinality: Cardinality.ONE_TO_MANY, lineStyle: 'straight', sourceMarker: 'none', targetMarker: 'arrow' },
        { id: 'r3', sourceId: 'c2', targetId: 'c3', cardinality: Cardinality.ONE_TO_MANY, lineStyle: 'straight', sourceMarker: 'none', targetMarker: 'arrow' }
    ],
    versions: []
  },
  {
    id: '3',
    name: 'Inventory System',
    description: 'Physical schema for inventory management',
    type: ModelType.PHYSICAL,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    entities: [
       { 
        id: 'p1', 
        name: 'products', 
        chineseName: '商品库存表',
        type: 'table', 
        collapsed: false,
        x: 100, 
        y: 100, 
        attributes: [
           { id: 'pa1', name: 'id', dataType: 'BIGINT', isPrimaryKey: true },
           { id: 'pa2', name: 'sku', dataType: 'VARCHAR(50)', isNullable: false },
           { id: 'pa3', name: 'name', dataType: 'VARCHAR(255)', isNullable: false },
           { id: 'pa4', name: 'price', dataType: 'DECIMAL(10,2)', isNullable: false },
           { id: 'pa5', name: 'stock_qty', dataType: 'INT', isNullable: false },
           { id: 'pa6', name: 'category_id', dataType: 'INT', isForeignKey: true },
           { id: 'pa7', name: 'created_at', dataType: 'TIMESTAMP' },
           { id: 'pa8', name: 'updated_at', dataType: 'TIMESTAMP' }
        ] 
      },
      { 
        id: 'p2', 
        name: 'categories', 
        chineseName: '分类表',
        type: 'table', 
        collapsed: true,
        x: 500, 
        y: 100, 
        attributes: [
           { id: 'pc1', name: 'id', dataType: 'INT', isPrimaryKey: true },
           { id: 'pc2', name: 'name', dataType: 'VARCHAR(100)' },
           { id: 'pc3', name: 'parent_id', dataType: 'INT' },
           { id: 'pc4', name: 'description', dataType: 'TEXT' },
           { id: 'pc5', name: 'is_active', dataType: 'BOOLEAN' },
           { id: 'pc6', name: 'created_at', dataType: 'TIMESTAMP' }
        ] 
      }
    ],
    relationships: [
       { id: 'pr1', sourceId: 'p2', targetId: 'p1', cardinality: Cardinality.ONE_TO_MANY, lineStyle: 'step', sourceMarker: 'one', targetMarker: 'crowfoot' }
    ],
    versions: []
  },
  {
    id: '4',
    name: 'Retail Analytics',
    description: 'Star schema for sales analysis',
    type: ModelType.DIMENSIONAL,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    entities: [
       { 
        id: 'd1', 
        name: 'fact_sales', 
        chineseName: '销售事实表',
        type: 'table',
        tableType: 'fact',
        collapsed: false,
        x: 400, 
        y: 200, 
        attributes: [
           { id: 'fa1', name: 'sale_id', dataType: 'BIGINT', isPrimaryKey: true },
           { id: 'fa2', name: 'date_key', dataType: 'INT', isForeignKey: true },
           { id: 'fa3', name: 'store_key', dataType: 'INT', isForeignKey: true },
           { id: 'fa4', name: 'product_key', dataType: 'INT', isForeignKey: true },
           { id: 'fa5', name: 'quantity', dataType: 'INT', isNullable: false },
           { id: 'fa6', name: 'unit_price', dataType: 'DECIMAL(18,2)', isNullable: false },
           { id: 'fa7', name: 'total_amount', dataType: 'DECIMAL(18,2)', isNullable: false }
        ] 
      },
      { 
        id: 'd2', 
        name: 'dim_product', 
        chineseName: '商品维度',
        type: 'table',
        tableType: 'dimension',
        collapsed: true,
        x: 100, 
        y: 100, 
        attributes: [
           { id: 'dp1', name: 'product_key', dataType: 'INT', isPrimaryKey: true },
           { id: 'dp2', name: 'sku', dataType: 'VARCHAR(50)' },
           { id: 'dp3', name: 'name', dataType: 'VARCHAR(255)' },
           { id: 'dp4', name: 'category', dataType: 'VARCHAR(100)' },
           { id: 'dp5', name: 'brand', dataType: 'VARCHAR(100)' }
        ] 
      },
       { 
        id: 'd3', 
        name: 'dim_store', 
        chineseName: '门店维度',
        type: 'table',
        tableType: 'dimension',
        collapsed: true,
        x: 100, 
        y: 350, 
        attributes: [
           { id: 'ds1', name: 'store_key', dataType: 'INT', isPrimaryKey: true },
           { id: 'ds2', name: 'store_name', dataType: 'VARCHAR(100)' },
           { id: 'ds3', name: 'city', dataType: 'VARCHAR(100)' },
           { id: 'ds4', name: 'region', dataType: 'VARCHAR(100)' }
        ] 
      },
       { 
        id: 'd4', 
        name: 'dim_date', 
        chineseName: '时间维度',
        type: 'table',
        tableType: 'dimension',
        collapsed: true,
        x: 700, 
        y: 200, 
        attributes: [
           { id: 'dd1', name: 'date_key', dataType: 'INT', isPrimaryKey: true },
           { id: 'dd2', name: 'full_date', dataType: 'DATE' },
           { id: 'dd3', name: 'year', dataType: 'INT' },
           { id: 'dd4', name: 'quarter', dataType: 'INT' },
           { id: 'dd5', name: 'month', dataType: 'INT' },
           { id: 'dd6', name: 'day_of_week', dataType: 'VARCHAR(20)' }
        ] 
      }
    ],
    relationships: [
       { id: 'dr1', sourceId: 'd2', targetId: 'd1', cardinality: Cardinality.ONE_TO_MANY, lineStyle: 'straight', sourceMarker: 'one', targetMarker: 'crowfoot' },
       { id: 'dr2', sourceId: 'd3', targetId: 'd1', cardinality: Cardinality.ONE_TO_MANY, lineStyle: 'straight', sourceMarker: 'one', targetMarker: 'crowfoot' },
       { id: 'dr3', sourceId: 'd4', targetId: 'd1', cardinality: Cardinality.ONE_TO_MANY, lineStyle: 'straight', sourceMarker: 'one', targetMarker: 'crowfoot' }
    ],
    versions: []
  }
];

// In-memory store simulating a database
let dbStore: DataModel[] = [...MOCK_MODELS];

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  fetchModels: async (): Promise<DataModel[]> => {
    await delay(800); // Simulate initial load latency
    return [...dbStore];
  },

  fetchModelById: async (id: string): Promise<DataModel | undefined> => {
    await delay(300);
    const model = dbStore.find(m => m.id === id);
    return model ? { ...model } : undefined;
  },

  createModel: async (model: DataModel): Promise<DataModel> => {
    await delay(600);
    dbStore.push(model);
    return model;
  },

  updateModel: async (id: string, updates: Partial<DataModel>): Promise<DataModel> => {
    // Simulate processing time
    await delay(400); 
    
    const index = dbStore.findIndex(m => m.id === id);
    if (index === -1) {
      throw new Error(`Model with id ${id} not found`);
    }

    // Merge updates
    const updatedModel = {
      ...dbStore[index],
      ...updates,
      updatedAt: Date.now()
    };
    
    dbStore[index] = updatedModel;
    return updatedModel;
  },

  deleteModel: async (id: string): Promise<void> => {
    await delay(500);
    dbStore = dbStore.filter(m => m.id !== id);
  }
};
