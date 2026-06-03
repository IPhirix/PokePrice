from dotenv import load_dotenv
import os
import json
import gzip
import shutil
import time
import requests
import pandas as pd
import psycopg2

from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from psycopg2.extras import execute_values

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

print("Starting Pokemon price pipeline...")

# -------------------------
# LOAD ENV
# -------------------------

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
PRICECHARTING_URL = os.getenv("PRICECHARTING_URL")
GOOGLE_DRIVE_FOLDER_ID = os.getenv(
    "GOOGLE_DRIVE_FOLDER_ID"
)
GOOGLE_TOKEN_JSON = os.getenv(
    "GOOGLE_TOKEN_JSON"
)

if not DATABASE_URL:
    raise Exception("DATABASE_URL missing")

if not PRICECHARTING_URL:
    raise Exception("PRICECHARTING_URL missing")

if not GOOGLE_DRIVE_FOLDER_ID:
    raise Exception(
        "GOOGLE_DRIVE_FOLDER_ID missing"
    )

if not GOOGLE_TOKEN_JSON:
    raise Exception(
        "GOOGLE_TOKEN_JSON missing"
    )

chicago_now = datetime.now(ZoneInfo("America/Chicago"))
today = chicago_now.strftime("%Y-%m-%d")
snapshot_date = chicago_now.date()

if chicago_now.hour < 6:
    print(
        f"It is {chicago_now.strftime('%I:%M %p')} Chicago time — "
        "PriceCharting data not yet updated (updates at 6:00 AM). "
        "Skipping pipeline."
    )
    raise SystemExit(0)

# -------------------------
# FILE PATHS
# -------------------------

download_folder = Path("PokemonPrices")
download_folder.mkdir(exist_ok=True)

csv_filename = (
    download_folder /
    f"pokemon_{today}.csv"
)

gz_filename = (
    download_folder /
    f"pokemon_{today}.csv.gz"
)

# -------------------------
# DOWNLOAD CSV
# -------------------------

print("Downloading PriceCharting CSV...")

response = requests.get(
    PRICECHARTING_URL,
    headers={"User-Agent": "Mozilla/5.0"},
    timeout=120
)

response.raise_for_status()

csv_filename.write_bytes(
    response.content
)

if csv_filename.stat().st_size < 100000:
    raise Exception(
        "Downloaded file too small."
    )

print(
    f"Downloaded: "
    f"{csv_filename.name}"
)

# -------------------------
# CONNECT TO SUPABASE
# -------------------------

print("Connecting to Supabase...")

max_attempts = 5
attempt = 1

while attempt <= max_attempts:
    try:
        conn = psycopg2.connect(
            DATABASE_URL,
            connect_timeout=30
        )

        cursor = conn.cursor()

        print("Connected to Supabase")
        break

    except Exception as e:
        print(
            f"Connection attempt "
            f"{attempt}/{max_attempts} failed"
        )

        print(e)

        if attempt == max_attempts:
            raise Exception(
                "Failed to connect to "
                "Supabase after retries."
            )

        time.sleep(15)
        attempt += 1

# -------------------------
# CHECK DAILY IMPORT
# -------------------------

def already_imported(
    cursor,
    snapshot_date
):
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1
            FROM pokemon_card_prices
            WHERE snapshot_date = %s
            LIMIT 1
        )
    """, (snapshot_date,))

    return cursor.fetchone()[0]


skip_database_import = False

if already_imported(
    cursor,
    snapshot_date
):
    print(
        f"Data already imported "
        f"for {snapshot_date}"
    )

    print(
        "Skipping database import."
    )

    skip_database_import = True

# -------------------------
# DATABASE IMPORT
# -------------------------

if not skip_database_import:

    df = pd.read_csv(csv_filename)

    print(
        f"Loaded "
        f"{len(df):,} rows"
    )

    def clean_price(value):
        if pd.isna(value):
            return None

        try:
            value = (
                str(value)
                .replace("$", "")
                .replace(",", "")
                .strip()
            )

            if value == "":
                return None

            return float(value)

        except (ValueError, TypeError):
            return None


    def clean_text(value):
        if pd.isna(value):
            return None

        return str(value).strip()


    def clean_int(value):
        if pd.isna(value):
            return None

        try:
            return int(value)

        except (ValueError, TypeError):
            return None

    records = []

    for _, row in df.iterrows():

        try:
            record = (
                clean_int(
                    row.get("id")
                ),

                clean_text(
                    row.get("tcg-id")
                ),

                clean_text(
                    row.get("upc")
                ),

                clean_text(
                    row.get("asin")
                ),

                clean_text(
                    row.get("epid")
                ),

                clean_text(
                    row.get(
                        "console-name"
                    )
                ),

                clean_text(
                    row.get(
                        "product-name"
                    )
                ),

                clean_text(
                    row.get("genre")
                ),

                (
                    row.get(
                        "release-date"
                    )
                    if pd.notna(
                        row.get(
                            "release-date"
                        )
                    )
                    else None
                ),

                clean_price(
                    row.get(
                        "loose-price"
                    )
                ),

                clean_price(
                    row.get(
                        "cib-price"
                    )
                ),

                clean_price(
                    row.get(
                        "new-price"
                    )
                ),

                clean_price(
                    row.get(
                        "graded-price"
                    )
                ),

                clean_price(
                    row.get(
                        "box-only-price"
                    )
                ),

                clean_price(
                    row.get(
                        "manual-only-price"
                    )
                ),

                clean_price(
                    row.get(
                        "bgs-10-price"
                    )
                ),

                clean_price(
                    row.get(
                        "condition-17-price"
                    )
                ),

                clean_price(
                    row.get(
                        "condition-18-price"
                    )
                ),

                clean_price(
                    row.get(
                        "gamestop-price"
                    )
                ),

                clean_price(
                    row.get(
                        "gamestop-trade-price"
                    )
                ),

                clean_price(
                    row.get(
                        "retail-loose-buy"
                    )
                ),

                clean_price(
                    row.get(
                        "retail-loose-sell"
                    )
                ),

                clean_price(
                    row.get(
                        "retail-cib-buy"
                    )
                ),

                clean_price(
                    row.get(
                        "retail-cib-sell"
                    )
                ),

                clean_price(
                    row.get(
                        "retail-new-buy"
                    )
                ),

                clean_price(
                    row.get(
                        "retail-new-sell"
                    )
                ),

                clean_int(
                    row.get(
                        "sales-volume"
                    )
                ),

                snapshot_date
            )

            records.append(record)

        except Exception as e:
            print(
                f"Skipping row: {e}"
            )

    print(
        f"Prepared "
        f"{len(records):,} records"
    )

    execute_values(
        cursor,
        """
        INSERT INTO pokemon_card_prices (
            pricecharting_id,
            tcg_id,
            upc,
            asin,
            epid,
            console_name,
            product_name,
            genre,
            release_date,
            loose_price,
            cib_price,
            new_price,
            graded_price,
            box_only_price,
            manual_only_price,
            bgs_10_price,
            condition_17_price,
            condition_18_price,
            gamestop_price,
            gamestop_trade_price,
            retail_loose_buy,
            retail_loose_sell,
            retail_cib_buy,
            retail_cib_sell,
            retail_new_buy,
            retail_new_sell,
            sales_volume,
            snapshot_date
        )
        VALUES %s
        ON CONFLICT DO NOTHING
        """,
        records,
        page_size=10000
    )

    conn.commit()

    print("Imported to Supabase")

cursor.close()
conn.close()

# -------------------------
# COMPRESS FILE
# -------------------------

print("Compressing CSV...")

with open(csv_filename, "rb") as f_in:
    with gzip.open(
        gz_filename,
        "wb",
        compresslevel=9
    ) as f_out:
        shutil.copyfileobj(
            f_in,
            f_out
        )

print(
    f"Compressed: "
    f"{gz_filename.name}"
)

# -------------------------
# GOOGLE DRIVE UPLOAD
# -------------------------

try:
    print(
        "Uploading to Google Drive..."
    )

    token_info = json.loads(
        GOOGLE_TOKEN_JSON
    )

    creds = (
        Credentials
        .from_authorized_user_info(
            token_info
        )
    )

    if (
        creds.expired and
        creds.refresh_token
    ):
        creds.refresh(Request())

    service = build(
        "drive",
        "v3",
        credentials=creds
    )

    existing_files = (
        service.files().list(
            q=(
                f"name="
                f"'{gz_filename.name}' "
                f"and "
                f"'{GOOGLE_DRIVE_FOLDER_ID}' "
                f"in parents "
                f"and trashed=false"
            ),
            fields="files(id,name)"
        ).execute()
    )

    files = (
        existing_files
        .get("files", [])
    )

    if files:
        print(
            "Backup already exists:"
        )
        print(gz_filename.name)

    else:
        media = MediaFileUpload(
            str(gz_filename),
            mimetype=(
                "application/gzip"
            )
        )

        service.files().create(
            body={
                "name":
                gz_filename.name,
                "parents": [
                    GOOGLE_DRIVE_FOLDER_ID
                ]
            },
            media_body=media,
            fields="id"
        ).execute()

        print("Upload complete")

except Exception as e:
    print(
        "Google Drive upload failed"
    )
    print(e)
    raise SystemExit(1)

# -------------------------
# CLEANUP
# -------------------------

print(
    "Cleaning up local files..."
)

try:
    if csv_filename.exists():
        csv_filename.unlink()

    media = None
    time.sleep(2)

    if gz_filename.exists():
        gz_filename.unlink()

    print(
        "Local files deleted"
    )

except Exception as e:
    print("Cleanup warning:")
    print(e)

print("Pipeline complete!")
