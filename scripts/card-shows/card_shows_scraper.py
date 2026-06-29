from dotenv import load_dotenv
import os
import re
import time
import requests
import psycopg2

from bs4 import BeautifulSoup

print("Starting card shows scraper...")

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

US_STATES = [
    ("AL", "Alabama"),
    ("AK", "Alaska"),
    ("AZ", "Arizona"),
    ("AR", "Arkansas"),
    ("CA", "California"),
    ("CO", "Colorado"),
    ("CT", "Connecticut"),
    ("DE", "Delaware"),
    ("FL", "Florida"),
    ("GA", "Georgia"),
    ("HI", "Hawaii"),
    ("ID", "Idaho"),
    ("IL", "Illinois"),
    ("IN", "Indiana"),
    ("IA", "Iowa"),
    ("KS", "Kansas"),
    ("KY", "Kentucky"),
    ("LA", "Louisiana"),
    ("ME", "Maine"),
    ("MD", "Maryland"),
    ("MA", "Massachusetts"),
    ("MI", "Michigan"),
    ("MN", "Minnesota"),
    ("MS", "Mississippi"),
    ("MO", "Missouri"),
    ("MT", "Montana"),
    ("NE", "Nebraska"),
    ("NV", "Nevada"),
    ("NH", "New Hampshire"),
    ("NJ", "New Jersey"),
    ("NM", "New Mexico"),
    ("NY", "New York"),
    ("NC", "North Carolina"),
    ("ND", "North Dakota"),
    ("OH", "Ohio"),
    ("OK", "Oklahoma"),
    ("OR", "Oregon"),
    ("PA", "Pennsylvania"),
    ("RI", "Rhode Island"),
    ("SC", "South Carolina"),
    ("SD", "South Dakota"),
    ("TN", "Tennessee"),
    ("TX", "Texas"),
    ("UT", "Utah"),
    ("VT", "Vermont"),
    ("VA", "Virginia"),
    ("WA", "Washington"),
    ("WV", "West Virginia"),
    ("WI", "Wisconsin"),
    ("WY", "Wyoming"),
    ("DC", "District of Columbia"),
]

CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
DATE_PATTERN = re.compile(r"\w+, \w+ \d+, \d{4}")
TIME_PATTERN = re.compile(r"\d+:\d+\s*(am|pm)", re.IGNORECASE)
ID_PATTERN = re.compile(r"ID=(\d+)", re.IGNORECASE)
BR_PATTERN = re.compile(r"<br\s*/?>", re.IGNORECASE)
TAG_PATTERN = re.compile(r"<[^>]+>")


def strip_tags(s):
    return TAG_PATTERN.sub("", s).strip() if s else ""


def fetch_card_shows(state_code, state_name, session):
    url = (
        f"https://www.tcdb.com/CardShows.cfm"
        f"?MODE=Location&State={state_code}"
        f"&Display={requests.utils.quote(state_name)}"
        f"&Country=United%20States"
    )
    resp = session.get(url, headers={"User-Agent": CHROME_UA}, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []

    for strong in soup.find_all("strong"):
        date_text = strong.get_text().strip()
        if not DATE_PATTERN.search(date_text):
            continue

        date_para = strong.parent
        if not date_para or date_para.name != "p":
            continue

        next_el = date_para.find_next_sibling()
        while next_el and next_el.name != "ul":
            next_el = next_el.find_next_sibling()
        if not next_el:
            continue

        for li in next_el.find_all("li"):
            link = li.find("a")
            name = link.get_text().strip() if link else ""
            href = link.get("href", "") if link else ""
            id_match = ID_PATTERN.search(href) if href else None
            show_id = id_match.group(1) if id_match else ""

            li_html = str(li)
            parts = BR_PATTERN.split(li_html)
            all_parts = [p for p in (strip_tags(p) for p in parts[1:]) if p]

            time_idx = next(
                (i for i, p in enumerate(all_parts) if TIME_PATTERN.search(p)),
                -1,
            )

            venue = all_parts[0] if all_parts else ""
            address = ""
            city_state = ""
            show_time = ""

            if time_idx >= 3:
                address = all_parts[1] if len(all_parts) > 1 else ""
                city_state = all_parts[2] if len(all_parts) > 2 else ""
                show_time = all_parts[time_idx]
            elif time_idx == 2:
                city_state = all_parts[1] if len(all_parts) > 1 else ""
                show_time = all_parts[2] if len(all_parts) > 2 else ""
            else:
                city_state = all_parts[1] if len(all_parts) > 1 else ""
                show_time = all_parts[time_idx] if time_idx >= 0 else ""

            results.append(
                {
                    "id": show_id,
                    "name": name,
                    "date": date_text,
                    "venue": venue,
                    "address": address,
                    "city_state": city_state,
                    "time": show_time,
                }
            )

    return results


def card_show_synthetic_id(state_code, show):
    if show["id"]:
        return show["id"]
    return f"{state_code}|{show['date']}|{show['name']}|{show['venue']}"[:250]


def upsert_shows(conn, state_code, state_name, shows):
    with conn.cursor() as cur:
        for show in shows:
            show_id = card_show_synthetic_id(state_code, show)
            cur.execute(
                """
                INSERT INTO card_shows_cache
                    (id, state_code, state_name, name, date, venue, address, city_state, time, fetched_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (id) DO UPDATE SET
                    fetched_at = now(),
                    venue      = EXCLUDED.venue,
                    address    = EXCLUDED.address,
                    city_state = EXCLUDED.city_state,
                    time       = EXCLUDED.time
                """,
                (
                    show_id,
                    state_code,
                    state_name,
                    show["name"],
                    show["date"],
                    show["venue"],
                    show["address"],
                    show["city_state"],
                    show["time"],
                ),
            )
    conn.commit()


def main():
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set")
        raise SystemExit(1)

    conn = psycopg2.connect(DATABASE_URL)
    session = requests.Session()
    total_shows = 0
    errors = []

    try:
        for state_code, state_name in US_STATES:
            try:
                shows = fetch_card_shows(state_code, state_name, session)
                if shows:
                    upsert_shows(conn, state_code, state_name, shows)
                    total_shows += len(shows)
                    print(f"[{state_code}] {state_name}: {len(shows)} shows")
                else:
                    print(f"[{state_code}] {state_name}: no shows")
            except Exception as e:
                print(f"[{state_code}] {state_name}: ERROR — {e}")
                errors.append((state_code, state_name, str(e)))

            time.sleep(1.5)
    finally:
        conn.close()
        session.close()

    print(f"\nDone. Total shows upserted: {total_shows}")

    if errors:
        print(f"\n{len(errors)} state(s) failed:")
        for code, name, err in errors:
            print(f"  {code} {name}: {err}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
