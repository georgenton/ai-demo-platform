// SchemaTable — port TS de ui.jsx::SchemaTable.
// Tarjeta compacta con nombre de tabla + columnas (name + type). Usado por
// Demo Agent para mostrar el schema accesible.

import { Icon } from './Icon';

export interface SchemaColumn {
  name: string;
  type: string;
}

export interface SchemaTableProps {
  name: string;
  columns: SchemaColumn[];
}

export function SchemaTable({ name, columns }: SchemaTableProps) {
  return (
    <div className="schema-table">
      <div className="schema-table-head">
        <Icon name="table" size={12} />
        <span className="schema-table-name">{name}</span>
      </div>
      <div>
        {columns.map((col) => (
          <div className="schema-col" key={col.name}>
            <span className="schema-col-name">{col.name}</span>
            <span className="schema-col-type">{col.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
