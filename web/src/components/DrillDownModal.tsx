interface Row {
  id: string;
  created_at: string;
  model?: string;
  tool_name?: string;
  file_type: string;
  attributed_cost: number;
  web_url?: string;
  project_name?: string;
}

interface Props {
  title: string;
  rows: Row[];
  onClose: () => void;
}

export function DrillDownModal({ title, rows, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <table className="drill-table">
          <thead>
            <tr>
              <th>Criado em</th>
              <th>Tipo</th>
              <th>Modelo</th>
              <th>Projeto</th>
              <th>Créditos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                <td>{r.file_type}</td>
                <td>{r.model ?? r.tool_name ?? "—"}</td>
                <td>{r.project_name ?? "—"}</td>
                <td>{Math.round(r.attributed_cost ?? 0).toLocaleString("pt-BR")}</td>
                <td>
                  {r.web_url && (
                    <a className="link" href={r.web_url} target="_blank" rel="noreferrer">
                      Abrir no Magnific
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6}>Nenhuma criação encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ marginTop: 14 }}>
          <button className="close-btn" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
