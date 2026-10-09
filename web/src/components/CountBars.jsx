import { CHART_COLORS } from '../constants';

/**
 * A card with one labelled bar per row, longest first, the count printed beside each bar.
 * One measure in one colour: the labels carry identity, the bar length carries magnitude.
 * @param {{ title: string, aside?: string, empty: string, testId?: string,
 *   rows: Array<{ key: string, label: string, count: number }> }} props
 */
export function CountBars({ title, aside, empty, rows, testId }) {
  const shown = rows.filter((row) => row.count > 0).sort((a, b) => b.count - a.count);
  const max = shown[0]?.count ?? 0;

  return (
    <section className="card panel" aria-label={title} data-testid={testId}>
      <div className="panel-head">
        <h2>{title}</h2>
        {aside ? <span className="panel-aside">{aside}</span> : null}
      </div>
      {shown.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="bar-list">
          {shown.map((row) => (
            <li key={row.key} data-testid="count-bar">
              <div className="bar-row">
                <span>{row.label}</span>
                <span className="strong">{row.count}</span>
              </div>
              <div className="bar-track" aria-hidden="true">
                <div
                  className="bar-fill"
                  style={{ width: `${(row.count / max) * 100}%`, background: CHART_COLORS.line }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
