import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import {
  categorySlug,
  getCategoryMeta,
  parseCategoryLabel,
} from '@/lib/categories';

/**
 * "Browse by category" on the homepage: plain links to the biggest indexable
 * category hubs plus the /best and /categories indexes, so every hub is one
 * click from the homepage (lib/homeCategories.ts picks them).
 */
export function HomeCategoryGrid({ categories }: { categories: string[] }) {
  if (categories.length === 0) return null;
  return (
    <section className="section" aria-labelledby="home-categories">
      <div className="container">
        <div className="section-head">
          <h2 id="home-categories" className="section-title">
            Browse MCP servers by category
          </h2>
          <p className="section-sub">
            Ranked lists of the most-used servers in each area, with install
            configs for Claude, Cursor and other clients.
          </p>
        </div>
        <ul className="dir-catgrid dir-catgrid--compact">
          {categories.map((category) => {
            const meta = getCategoryMeta(category);
            const { label } = parseCategoryLabel(category);
            return (
              <li key={category}>
                <Link
                  href={`/categories/${categorySlug(category)}`}
                  className={`dir-catcard spotlight tint-card hue-${meta.hue}`}
                >
                  <div className="dir-catcard-head">
                    <span className="dir-catcard-icon" aria-hidden="true">
                      {meta.emoji}
                    </span>
                    <div className="dir-catcard-titles">
                      <h3 className="dir-catcard-title">{label}</h3>
                    </div>
                    <ArrowUpRight
                      size={16}
                      className="dir-catcard-arrow"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="home-intents-foot">
          <Link href="/categories" className="link-arrow">
            All categories <ArrowRight size={15} aria-hidden="true" />
          </Link>{' '}
          <Link href="/best" className="link-arrow">
            Best MCP servers by topic{' '}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
