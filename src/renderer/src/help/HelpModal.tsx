import { BookOpenText, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { helpArticleMatches, helpArticles } from './helpLibrary'

export default function HelpModal({
  onClose,
  onStartTour
}: {
  onClose: () => void
  onStartTour: () => void
}): ReactElement {
  const [query, setQuery] = useState('')
  const filteredArticles = helpArticles.filter((article) => helpArticleMatches(article, query))
  const [selectedArticleId, setSelectedArticleId] = useState(filteredArticles[0]?.id ?? helpArticles[0]?.id ?? '')
  const selectedArticle = filteredArticles.length === 0 ? null : filteredArticles.find((article) => article.id === selectedArticleId) ?? filteredArticles[0]

  useEffect(() => {
    if (!filteredArticles.length) return
    if (!filteredArticles.some((article) => article.id === selectedArticleId)) {
      setSelectedArticleId(filteredArticles[0].id)
    }
  }, [filteredArticles, selectedArticleId])

  const groupedArticles = filteredArticles.reduce<Record<string, typeof helpArticles>>((acc, article) => {
    if (!acc[article.category]) acc[article.category] = []
    acc[article.category].push(article)
    return acc
  }, {})

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="modal-card modal-card-wide help-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Help</p>
            <h3>Learn the app your way</h3>
          </div>
        </div>
        <div className="modal-body help-modal-body">
          <section className="help-hero">
            <div className="help-hero-copy">
              <strong>Guided Tour</strong>
              <p>Use the tour for a quick, reusable walkthrough of the main workspace. Use the articles below when you want a focused explanation without clicking through the whole tour again.</p>
            </div>
            <button className="primary-button" onClick={onStartTour} type="button">
              <BookOpenText size={16} />
              Start Guided Tour
            </button>
          </section>
          <div className="help-toolbar">
            <label className="help-search">
              <span className="help-search-icon">
                <Search size={15} />
              </span>
              <input onChange={(event) => setQuery(event.target.value)} placeholder="Search help topics" value={query} />
            </label>
            <button className="icon-button" onClick={() => setQuery(query.trim())} type="button">
              Search
            </button>
          </div>
          <div className="help-layout">
            <aside aria-label="Help topics" className="help-topic-list">
              {Object.entries(groupedArticles).map(([category, articles]) => (
                <section className="help-topic-group" key={category}>
                  <p className="help-topic-group-label">{category}</p>
                  <div className="help-topic-buttons">
                    {articles.map((article) => (
                      <button
                        className={selectedArticle?.id === article.id ? 'help-topic-button active' : 'help-topic-button'}
                        key={article.id}
                        onClick={() => setSelectedArticleId(article.id)}
                        type="button"
                      >
                        <strong>{article.title}</strong>
                        <span>{article.summary}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              {!filteredArticles.length && (
                <div className="help-empty-state">
                  <strong>No topics found</strong>
                  <span>Try a broader keyword like board, widget, wishlist, or layout.</span>
                </div>
              )}
            </aside>
            <section aria-label="Help article" className="help-article-view">
              {selectedArticle ? (
                <>
                  <div className="help-article-header">
                    <p className="eyebrow">{selectedArticle.category}</p>
                    <h3>{selectedArticle.title}</h3>
                    <p>{selectedArticle.summary}</p>
                  </div>
                  <div className="help-article-content">
                    {selectedArticle.sections.map((section, index) => (
                      <section className="help-article-section" key={`${selectedArticle.id}-${index}`}>
                        {section.title && <h4>{section.title}</h4>}
                        {section.paragraphs.map((paragraph, paragraphIndex) => (
                          <p key={`${selectedArticle.id}-${index}-p-${paragraphIndex}`}>{paragraph}</p>
                        ))}
                        {section.bullets && section.bullets.length > 0 && (
                          <ul>
                            {section.bullets.map((bullet, bulletIndex) => (
                              <li key={`${selectedArticle.id}-${index}-b-${bulletIndex}`}>{bullet}</li>
                            ))}
                          </ul>
                        )}
                      </section>
                    ))}
                  </div>
                </>
              ) : (
                <div className="help-empty-state">
                  <strong>No article selected</strong>
                </div>
              )}
            </section>
          </div>
        </div>
        <div className="modal-actions">
          <button className="primary-button" onClick={onClose} type="button">
            Close Help
          </button>
        </div>
      </div>
    </div>
  )
}


