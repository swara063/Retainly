import React from 'react';

export function PageShell({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  const showHeader = Boolean(title || subtitle);
  return (
    <div className="pageShell">
      {showHeader ? (
        <div className="pageHeader">
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <section className="card sectionCard">
      <div className="sectionCardHeader">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="emptyState">
      <b>{title}</b>
      <p className="muted">{description}</p>
    </div>
  );
}

export function PrimaryButton(props: React.ComponentPropsWithoutRef<'a'> & { href?: string }) {
  return <a {...props} className={`download ${props.className || ''}`.trim()} />;
}

export function SecondaryButton(props: React.ComponentPropsWithoutRef<'a'> & { href?: string }) {
  return <a {...props} className={`download secondary ${props.className || ''}`.trim()} />;
}
