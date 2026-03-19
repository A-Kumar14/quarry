"""
services/citation_service.py — Citation metadata extraction and formatting.

Metadata resolution order per URL:
  1. ArXiv API (if arxiv.org URL)
  2. CrossRef API (if DOI detected in URL)
  3. HTML meta-tag scraping (og:, citation_*, dc.*, standard title/author)
"""

import logging
import re
import unicodedata
from datetime import date
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; Quarry/1.0; "
        "+https://github.com/quarry-search/quarry; mailto:research@quarry.app)"
    )
}
_TIMEOUT = 8


# ── Metadata dataclass ─────────────────────────────────────────────────────────

class CitationMeta:
    __slots__ = ("title", "authors", "year", "source", "url", "doi", "volume",
                 "issue", "pages", "publisher", "arxiv_id")

    def __init__(self, **kw):
        for k in self.__slots__:
            setattr(self, k, kw.get(k) or "")

    def as_dict(self):
        return {k: getattr(self, k) for k in self.__slots__}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _clean(text: str) -> str:
    """Collapse whitespace and remove zero-width characters."""
    text = unicodedata.normalize("NFC", text or "")
    return re.sub(r"\s+", " ", text).strip()


def _initials(name: str) -> str:
    """'Jane Doe' → 'J. D.'"""
    parts = name.strip().split()
    return " ".join(p[0].upper() + "." for p in parts if p)


def _last_first(name: str) -> str:
    """'Jane Marie Doe' → 'Doe, J. M.'"""
    parts = name.strip().split()
    if not parts:
        return name
    last = parts[-1]
    first_initials = " ".join(p[0].upper() + "." for p in parts[:-1])
    return f"{last}, {first_initials}" if first_initials else last


def _format_author_list_apa(authors: list[str]) -> str:
    """APA: Last, F. M., & Last, F. M."""
    if not authors:
        return ""
    formatted = [_last_first(a) for a in authors]
    if len(formatted) == 1:
        return formatted[0]
    return ", ".join(formatted[:-1]) + ", & " + formatted[-1]


def _format_author_list_mla(authors: list[str]) -> str:
    """MLA: Last, First[, and First Last]."""
    if not authors:
        return ""
    if len(authors) == 1:
        return _last_first(authors[0]) + "."
    first = _last_first(authors[0])
    rest = [a for a in authors[1:]]
    if len(rest) > 2:
        return first + ", et al."
    return first + ", and " + ", ".join(rest) + "."


def _slug(text: str) -> str:
    """Make a BibTeX key fragment."""
    return re.sub(r"[^a-z0-9]", "", text.lower())[:20]


# ── Source-specific fetchers ───────────────────────────────────────────────────

def _fetch_arxiv(arxiv_id: str) -> Optional[CitationMeta]:
    url = f"https://export.arxiv.org/abs/{arxiv_id}"
    api_url = (
        f"http://export.arxiv.org/api/query"
        f"?id_list={arxiv_id}&max_results=1"
    )
    try:
        resp = requests.get(api_url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "xml")
        entry = soup.find("entry")
        if not entry:
            return None
        title = _clean(entry.find("title").get_text()) if entry.find("title") else ""
        authors = [_clean(a.find("name").get_text()) for a in entry.find_all("author") if a.find("name")]
        pub_date = entry.find("published")
        year = pub_date.get_text()[:4] if pub_date else ""
        return CitationMeta(
            title=title, authors=authors, year=year,
            source="arXiv", url=url, arxiv_id=arxiv_id,
        )
    except Exception as exc:
        logger.warning("_fetch_arxiv failed id=%s: %s", arxiv_id, exc)
        return None


def _fetch_crossref(doi: str) -> Optional[CitationMeta]:
    api_url = f"https://api.crossref.org/works/{doi}"
    try:
        resp = requests.get(api_url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
        work = resp.json().get("message", {})

        def _get_names(items):
            out = []
            for item in items or []:
                given = item.get("given", "")
                family = item.get("family", "")
                out.append(f"{given} {family}".strip() if given else family)
            return out

        authors = _get_names(work.get("author"))
        year_parts = (work.get("published-print") or work.get("published-online") or {}).get("date-parts", [[]])
        year = str(year_parts[0][0]) if year_parts and year_parts[0] else ""
        title_list = work.get("title", [])
        title = _clean(title_list[0]) if title_list else ""
        container = work.get("container-title", [])
        source = _clean(container[0]) if container else work.get("publisher", "")
        return CitationMeta(
            title=title, authors=authors, year=year,
            source=source,
            url=f"https://doi.org/{doi}",
            doi=doi,
            volume=str(work.get("volume", "")),
            issue=str(work.get("issue", "")),
            pages=work.get("page", ""),
            publisher=work.get("publisher", ""),
        )
    except Exception as exc:
        logger.warning("_fetch_crossref failed doi=%s: %s", doi, exc)
        return None


def _scrape_meta(url: str) -> CitationMeta:
    """Fallback: extract citation metadata from HTML meta tags."""
    meta = CitationMeta(url=url)
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=_TIMEOUT, allow_redirects=True)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        def _m(name=None, prop=None):
            tag = soup.find("meta", attrs={"name": name} if name else {"property": prop})
            return _clean(tag["content"]) if tag and tag.get("content") else ""

        # Title: try og, citation, dc, then <title>
        meta.title = (
            _m(prop="og:title") or _m(name="citation_title") or
            _m(name="dc.title") or _m(name="DC.title") or
            (_clean(soup.title.get_text()) if soup.title else "")
        )

        # Authors
        author_tags = soup.find_all("meta", attrs={"name": re.compile(r"citation_author$", re.I)})
        if author_tags:
            meta.authors = [_clean(t["content"]) for t in author_tags if t.get("content")]
        else:
            single = _m(name="author") or _m(prop="article:author") or _m(name="dc.creator")
            if single:
                meta.authors = [single]

        # Year: try citation_date, article:published_time, og, dc.date
        raw_date = (
            _m(name="citation_publication_date") or
            _m(prop="article:published_time") or
            _m(name="dc.date") or _m(name="DC.date")
        )
        if raw_date:
            m = re.search(r"\b(19|20)\d{2}\b", raw_date)
            meta.year = m.group() if m else ""

        # Journal / source
        meta.source = _m(name="citation_journal_title") or _m(prop="og:site_name") or ""

        # DOI
        doi_tag = _m(name="citation_doi") or _m(name="dc.identifier")
        if doi_tag and "10." in doi_tag:
            meta.doi = doi_tag

        # Publisher
        meta.publisher = _m(name="citation_publisher") or _m(name="dc.publisher") or ""

    except Exception as exc:
        logger.warning("_scrape_meta failed url=%s: %s", url, exc)

    return meta


# ── Main resolution ────────────────────────────────────────────────────────────

def _extract_arxiv_id(url: str) -> Optional[str]:
    m = re.search(r"arxiv\.org/(?:abs|pdf)/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)", url)
    return m.group(1) if m else None


def _extract_doi(url: str) -> Optional[str]:
    # doi.org/10.xxx or direct doi in URL
    m = re.search(r"\b(10\.\d{4,9}/[^\s\"'<>]+)", url)
    return m.group(1).rstrip("/.,;") if m else None


def resolve_metadata(url: str) -> CitationMeta:
    """Try ArXiv → CrossRef → HTML scraping. Always returns a CitationMeta."""
    arxiv_id = _extract_arxiv_id(url)
    if arxiv_id:
        result = _fetch_arxiv(arxiv_id)
        if result:
            return result

    doi = _extract_doi(url)
    if doi:
        result = _fetch_crossref(doi)
        if result:
            return result

    return _scrape_meta(url)


# ── Formatters ─────────────────────────────────────────────────────────────────

def format_apa(meta: CitationMeta) -> str:
    """APA 7th edition."""
    author_str = _format_author_list_apa(meta.authors) if meta.authors else ""
    year_str   = f"({meta.year})." if meta.year else f"({date.today().year})."
    title_str  = meta.title + "." if meta.title else "Untitled."
    source_str = f"*{meta.source}*." if meta.source else ""
    vol_str    = f" *{meta.volume}*" if meta.volume else ""
    iss_str    = f"({meta.issue})" if meta.issue else ""
    pages_str  = f", {meta.pages}" if meta.pages else ""
    doi_str    = f" https://doi.org/{meta.doi}" if meta.doi else (f" {meta.url}" if meta.url else "")

    parts = [p for p in [author_str, year_str, title_str,
                          f"{source_str}{vol_str}{iss_str}{pages_str}{doi_str}"] if p]
    return " ".join(parts)


def format_mla(meta: CitationMeta) -> str:
    """MLA 9th edition."""
    author_str  = _format_author_list_mla(meta.authors) if meta.authors else ""
    title_str   = f'"{meta.title}."' if meta.title else '"Untitled."'
    source_str  = f"*{meta.source}*," if meta.source else ""
    year_str    = meta.year + "," if meta.year else ""
    url_str     = (f"https://doi.org/{meta.doi}" if meta.doi else meta.url) + "."

    parts = [p for p in [author_str, title_str, source_str, year_str, url_str] if p]
    return " ".join(parts)


def format_chicago(meta: CitationMeta) -> str:
    """Chicago 17th (notes-bibliography)."""
    if meta.authors:
        first = _last_first(meta.authors[0])
        rest  = [a for a in meta.authors[1:]]
        author_str = (first + ", " + ", ".join(rest) + ".") if rest else (first + ".")
    else:
        author_str = ""

    title_str  = f'"{meta.title}."' if meta.title else '"Untitled."'
    source_str = f"*{meta.source}*" if meta.source else ""
    year_str   = meta.year + "." if meta.year else ""
    vol_str    = f" {meta.volume}" if meta.volume else ""
    iss_str    = f", no. {meta.issue}" if meta.issue else ""
    pages_str  = f": {meta.pages}" if meta.pages else ""
    doi_str    = f" https://doi.org/{meta.doi}." if meta.doi else (f" {meta.url}." if meta.url else "")

    journal_part = f"{source_str}{vol_str}{iss_str}{pages_str}{doi_str}" if source_str else doi_str
    parts = [p for p in [author_str, title_str, journal_part, year_str] if p]
    return " ".join(parts)


def format_bibtex(meta: CitationMeta) -> str:
    """BibTeX entry."""
    entry_type = "article" if meta.source else "misc"
    first_author_slug = _slug(meta.authors[0].split()[-1]) if meta.authors else "unknown"
    year_slug = meta.year or str(date.today().year)
    title_slug = _slug(meta.title.split()[0]) if meta.title else "untitled"
    key = f"{first_author_slug}{year_slug}{title_slug}"

    author_bibtex = " and ".join(meta.authors) if meta.authors else ""

    lines = [f"@{entry_type}{{{key},"]
    if author_bibtex: lines.append(f"  author    = {{{author_bibtex}}},")
    if meta.title:    lines.append(f"  title     = {{{meta.title}}},")
    if meta.year:     lines.append(f"  year      = {{{meta.year}}},")
    if meta.source:   lines.append(f"  journal   = {{{meta.source}}},")
    if meta.volume:   lines.append(f"  volume    = {{{meta.volume}}},")
    if meta.issue:    lines.append(f"  number    = {{{meta.issue}}},")
    if meta.pages:    lines.append(f"  pages     = {{{meta.pages}}},")
    if meta.doi:      lines.append(f"  doi       = {{{meta.doi}}},")
    if meta.url:      lines.append(f"  url       = {{{meta.url}}},")
    if meta.publisher: lines.append(f"  publisher = {{{meta.publisher}}},")
    lines.append("}")
    return "\n".join(lines)


FORMATTERS = {
    "apa":     format_apa,
    "mla":     format_mla,
    "chicago": format_chicago,
    "bibtex":  format_bibtex,
}


def cite(url: str, style: str = "apa") -> dict:
    """
    Resolve metadata for `url` and return formatted citation.
    Returns {"citation": str, "style": str, "meta": dict}
    """
    meta = resolve_metadata(url)
    formatter = FORMATTERS.get(style, format_apa)
    return {
        "citation": formatter(meta),
        "style": style,
        "meta": meta.as_dict(),
    }
