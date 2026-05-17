import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiClient } from "../../services/apiClient.js";

function readValue(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") return row[key];
  }
  return "-";
}

function rowKey(row, index) {
  return row?.id || row?.order_code || row?.orderCode || row?.invoice_code || row?.invoiceCode || row?.discordId || index;
}

export default function ActionResourcePage({ title, endpoint, dataKey, columns, actions = [], toolbar = null, transformRows = null }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKey, setBusyKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(endpoint);
      setData(response.data);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  const baseRows = data?.[dataKey] || [];
  const rows = transformRows ? transformRows(baseRows) : baseRows;

  async function runAction(action, row, index) {
    const key = `${action.label}-${rowKey(row, index)}`;
    setBusyKey(key);
    setError(null);
    try {
      await action.run(row);
      await load();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusyKey("");
    }
  }

  return (
    <main className="content-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <span>{loading ? "Loading" : `${rows.length} data`}</span>
        </div>
        <button className="icon-button" type="button" onClick={load} title="Refresh" disabled={loading}>
          <RefreshCw size={17} />
        </button>
      </div>

      {toolbar ? <div className="toolbar-strip">{toolbar({ reload: load, setError })}</div> : null}
      {error ? <p className="inline-alert">{error.response?.data?.message || "Aksi gagal atau role tidak memiliki akses."}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => <th key={column.label}>{column.label}</th>)}
              {actions.length ? <th>Aksi</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const availableActions = actions.filter((action) => !action.visible || action.visible(row));
              return (
                <tr key={rowKey(row, index)}>
                  {columns.map((column) => (
                    <td key={column.label}>{column.render ? column.render(row) : String(readValue(row, column.keys))}</td>
                  ))}
                  {actions.length ? (
                    <td>
                      <div className="row-actions">
                        {availableActions.map((action) => {
                          const key = `${action.label}-${rowKey(row, index)}`;
                          return (
                            <button
                              key={action.label}
                              className={`table-action ${action.tone || ""}`}
                              type="button"
                              disabled={busyKey === key}
                              onClick={() => runAction(action, row, index)}
                            >
                              {busyKey === key ? "..." : action.label}
                            </button>
                          );
                        })}
                        {!availableActions.length ? <span className="muted">-</span> : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions.length ? 1 : 0)}>Belum ada data.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
