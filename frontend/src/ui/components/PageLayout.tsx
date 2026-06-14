import React from 'react';
import { Link } from 'react-router-dom';

export function PageShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="pageShell">
      <div className="pageHeader">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
      </div>
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

export function EmptyState({ title, description, homeHref = '/' }: { title: string; description: string; homeHref?: string }) {
  return (
    <div className="emptyState">
      <b>{title}</b>
      <p className="muted">{description}</p>
      <Link className="download secondary" to={homeHref}>Go to Home</Link>
    </div>
  );
}

export function PrimaryButton(props: React.ComponentPropsWithoutRef<'a'> & { href?: string }) {
  return <a {...props} className={`download ${props.className || ''}`.trim()} />;
}

export function SecondaryButton(props: React.ComponentPropsWithoutRef<'a'> & { href?: string }) {
  return <a {...props} className={`download secondary ${props.className || ''}`.trim()} />;
}
