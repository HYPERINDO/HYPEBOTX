import { useApi } from "../../hooks/useApi.js";

function valueOf(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") return row[key];
  }
  return "-";
}

export default function ResourcePage({ title, endpoint, dataKey, columns }) {
  const { data, loading, error } = useApi(endpoint);
  const rows = data?.[dataKey] || [];

  return (
    <main className="content-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <span>{loading ? "Loading" : `${rows.length} data`}</span>
      </div>
      {error ? <p className="inline-alert">Data belum tersedia atau role tidak memiliki akses.</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => <th key={column.label}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || row.order_code || row.discordId || index}>
                {columns.map((column) => <td key={column.label}>{String(valueOf(row, column.keys))}</td>)}
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>Belum ada data.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
