"""
Tests for parse_card_shows_html.

Fixtures reflect the actual TCDB HTML structure as of 2026-06-29:
  <p><strong>Weekday, Month DD, YYYY</strong></p>
  <p><ul>
    <li><a href="/CardShows.cfm?MODE=VIEW&ID=12345">Show Name</a><br>
    Venue<br>
    City, ST<br>
    HH:MM AM - HH:MM PM</li>
  </ul></p>
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from card_shows_scraper import parse_card_shows_html

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures")

SINGLE_SHOW_HTML = """
<html><body>
<p><strong>Sunday, July 5, 2026</strong></p>
<p><ul><li><a href="/CardShows.cfm?MODE=VIEW&ID=22983">Cincinnati Pokemon Show</a><br>
American Legion<br>
Cincinnati, OH<br>
9:00 AM - 3:00 PM</li></ul></p>
</body></html>
"""

MULTI_SHOW_SAME_DATE_HTML = """
<html><body>
<p><strong>Saturday, July 11, 2026</strong></p>
<p><ul>
<li><a href="/CardShows.cfm?MODE=VIEW&ID=19064">Field of Dreams Sports &amp; More</a><br>
The Gathering Place<br>
Wheelersburg, OH<br>
9:00 AM - 3:00 PM</li>
<li><a href="/CardShows.cfm?MODE=VIEW&ID=18994">Hartville Marketplace Show</a><br>
Hartville MarketPlace &amp; Flea Market<br>
Hartville, OH<br>
9:00 AM - 4:00 PM</li>
</ul></p>
</body></html>
"""

MULTI_DATE_HTML = """
<html><body>
<p><strong>Sunday, July 5, 2026</strong></p>
<p><ul><li><a href="/CardShows.cfm?MODE=VIEW&ID=22983">Cincinnati Pokemon Show</a><br>
American Legion<br>
Cincinnati, OH<br>
9:00 AM - 3:00 PM</li></ul></p>

<p><strong>Wednesday, July 8, 2026</strong></p>
<p><ul><li><a href="/CardShows.cfm?MODE=VIEW&ID=18814">Strongsville Wednesday Night Show</a><br>
Best Western Plus<br>
Strongsville, OH<br>
5:00 PM - 9:00 PM</li></ul></p>
</body></html>
"""

NO_SHOWS_HTML = """
<html><body>
<h3 class="site">Wyoming</h3>
<p>No card shows found for this state.</p>
</body></html>
"""

MISSING_TIME_HTML = """
<html><body>
<p><strong>Saturday, August 1, 2026</strong></p>
<p><ul><li><a href="/CardShows.cfm?MODE=VIEW&ID=99999">Mystery Show</a><br>
Some Venue<br>
Some City, OH</li></ul></p>
</body></html>
"""


class TestSingleShow:
    def test_returns_one_show(self):
        shows = parse_card_shows_html(SINGLE_SHOW_HTML, "OH")
        assert len(shows) == 1

    def test_show_name(self):
        shows = parse_card_shows_html(SINGLE_SHOW_HTML, "OH")
        assert shows[0]["name"] == "Cincinnati Pokemon Show"

    def test_show_id(self):
        shows = parse_card_shows_html(SINGLE_SHOW_HTML, "OH")
        assert shows[0]["id"] == "22983"

    def test_show_date(self):
        shows = parse_card_shows_html(SINGLE_SHOW_HTML, "OH")
        assert shows[0]["date"] == "Sunday, July 5, 2026"

    def test_show_venue(self):
        shows = parse_card_shows_html(SINGLE_SHOW_HTML, "OH")
        assert shows[0]["venue"] == "American Legion"

    def test_show_city_state(self):
        shows = parse_card_shows_html(SINGLE_SHOW_HTML, "OH")
        assert shows[0]["city_state"] == "Cincinnati, OH"

    def test_show_time(self):
        shows = parse_card_shows_html(SINGLE_SHOW_HTML, "OH")
        assert shows[0]["time"] == "9:00 AM - 3:00 PM"


class TestMultipleShowsSameDate:
    def test_returns_all_shows(self):
        shows = parse_card_shows_html(MULTI_SHOW_SAME_DATE_HTML, "OH")
        assert len(shows) == 2

    def test_all_shows_get_correct_date(self):
        shows = parse_card_shows_html(MULTI_SHOW_SAME_DATE_HTML, "OH")
        assert all(s["date"] == "Saturday, July 11, 2026" for s in shows)

    def test_first_show_name(self):
        shows = parse_card_shows_html(MULTI_SHOW_SAME_DATE_HTML, "OH")
        assert shows[0]["name"] == "Field of Dreams Sports & More"

    def test_second_show_id(self):
        shows = parse_card_shows_html(MULTI_SHOW_SAME_DATE_HTML, "OH")
        assert shows[1]["id"] == "18994"


class TestMultipleDates:
    def test_returns_shows_from_all_dates(self):
        shows = parse_card_shows_html(MULTI_DATE_HTML, "OH")
        assert len(shows) == 2

    def test_dates_are_distinct(self):
        shows = parse_card_shows_html(MULTI_DATE_HTML, "OH")
        dates = {s["date"] for s in shows}
        assert dates == {"Sunday, July 5, 2026", "Wednesday, July 8, 2026"}


class TestEdgeCases:
    def test_no_shows_returns_empty_list(self):
        shows = parse_card_shows_html(NO_SHOWS_HTML, "WY")
        assert shows == []

    def test_missing_time_doesnt_crash(self):
        shows = parse_card_shows_html(MISSING_TIME_HTML, "OH")
        assert len(shows) == 1
        assert shows[0]["time"] == ""

    def test_empty_html_returns_empty_list(self):
        shows = parse_card_shows_html("", "OH")
        assert shows == []


class TestRealFixture:
    """Parses the saved real TCDB response for Ohio."""

    @pytest.fixture
    def ohio_html(self):
        path = os.path.join(FIXTURE_DIR, "ohio.html")
        if not os.path.exists(path):
            pytest.skip("Ohio fixture not present — run fetch_fixture.py to generate")
        with open(path, encoding="utf-8") as f:
            return f.read()

    def test_parses_shows_from_real_html(self, ohio_html):
        shows = parse_card_shows_html(ohio_html, "OH")
        assert len(shows) > 0, "Expected at least one show from real Ohio HTML"

    def test_all_shows_have_name(self, ohio_html):
        shows = parse_card_shows_html(ohio_html, "OH")
        assert all(s["name"] for s in shows), "Every show must have a name"

    def test_all_shows_have_date(self, ohio_html):
        shows = parse_card_shows_html(ohio_html, "OH")
        assert all(s["date"] for s in shows), "Every show must have a date"

    def test_all_shows_have_id(self, ohio_html):
        shows = parse_card_shows_html(ohio_html, "OH")
        assert all(s["id"] for s in shows), "Every show must have an ID"
