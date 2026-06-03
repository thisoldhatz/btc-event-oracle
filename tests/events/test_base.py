from btc_oracle.events.base import Event, condense, iso_from_epoch, iso_from_ms, iso_from_gdelt


def test_iso_helpers():
    assert iso_from_epoch("1780444800").startswith("2026-")
    assert iso_from_ms("1780502400000").startswith("2026-")
    assert iso_from_gdelt("20260603T100000Z") == "2026-06-03T10:00:00+00:00"


def test_condense_formats_one_bullet_per_event():
    evs = [
        Event(source="fng", signal="fear_greed", value=11.0, delta=-12.0,
              interpretation="Extreme Fear", observed_at="2026-06-03T00:00:00+00:00"),
        Event(source="funding", signal="funding_rate", value=0.0000814, delta=None,
              interpretation="longs pay", observed_at="2026-06-03T08:00:00+00:00"),
    ]
    text = condense(evs)
    lines = text.splitlines()
    assert len(lines) == 2
    assert lines[0].startswith("- [fng] fear_greed")
    assert "Extreme Fear" in lines[0]
    assert "(no event signals" not in text


def test_condense_handles_empty():
    assert "no event signals" in condense([])
