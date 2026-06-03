from btc_oracle.events.news import NewsItem, parse_rss, fetch_news, news_to_dict

RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Feed</title>
  <item><title>Bitcoin tags new high</title><link>https://x.com/a</link>
    <pubDate>Wed, 03 Jun 2026 20:33:51 +0000</pubDate></item>
  <item><title>Ether slips</title><link>https://x.com/b</link>
    <pubDate>Wed, 03 Jun 2026 16:09:12 +0000</pubDate></item>
  <item><title>No link should be skipped</title><pubDate>Wed, 03 Jun 2026 10:00:00 +0000</pubDate></item>
</channel></rss>"""


def test_parse_rss_extracts_items_and_iso_dates():
    items = parse_rss(RSS, "CoinDesk")
    assert len(items) == 2                      # the link-less item is dropped
    assert items[0].title == "Bitcoin tags new high"
    assert items[0].url == "https://x.com/a"
    assert items[0].source == "CoinDesk"
    assert items[0].published_at.startswith("2026-06-03T20:33:51")


def test_parse_rss_bad_xml_returns_empty():
    assert parse_rss("not xml", "CoinDesk") == []


def test_fetch_news_merges_sorts_desc_and_is_fail_soft():
    older = RSS.replace("20:33:51", "08:00:00").replace("Bitcoin tags new high", "Older CT item")
    def http_get_text(url):
        if "coindesk" in url:
            return RSS
        if "cointelegraph" in url:
            return older
        raise RuntimeError("boom")
    items = fetch_news(http_get_text, limit=5)
    # newest first across both feeds (CoinDesk 20:33 item leads)
    assert items[0].title == "Bitcoin tags new high"
    assert all(items[i].published_at >= items[i + 1].published_at for i in range(len(items) - 1))


def test_fetch_news_one_feed_down_still_returns_other():
    def http_get_text(url):
        if "coindesk" in url:
            return RSS
        raise RuntimeError("cointelegraph down")
    items = fetch_news(http_get_text)
    assert len(items) >= 1


def test_news_to_dict_shape():
    d = news_to_dict([NewsItem(title="t", url="u", source="s", published_at="2026-01-01T00:00:00+00:00")])
    assert d == [{"title": "t", "url": "u", "source": "s", "published_at": "2026-01-01T00:00:00+00:00"}]
