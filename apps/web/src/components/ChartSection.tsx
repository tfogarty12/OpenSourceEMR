import type { ReactNode } from 'react';

/** A titled list panel for one chart domain (problems, allergies, …). */
export function ChartSection<T>({
  title,
  items,
  renderItem,
  emptyText,
}: {
  title: string;
  items: T[];
  renderItem: (item: T) => ReactNode;
  emptyText?: string;
}) {
  return (
    <section className="chart-section" aria-label={title}>
      <h3>
        {title} <span className="muted">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="muted">{emptyText ?? 'None recorded'}</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={index}>{renderItem(item)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
