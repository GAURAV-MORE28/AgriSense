import { Pool } from 'pg';
export declare const query: (text: string, params?: any[]) => Promise<import("pg").QueryResult<any>>;
export declare const getClient: () => Promise<import("pg").PoolClient>;
declare const _default: {
    query: (text: string, params?: any[]) => Promise<import("pg").QueryResult<any>>;
    getClient: () => Promise<import("pg").PoolClient>;
    pool: Pool;
};
export default _default;
//# sourceMappingURL=db.d.ts.map