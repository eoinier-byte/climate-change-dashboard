import logging
import zipfile
from abc import ABC, abstractmethod
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3 import Retry

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s]: %(message)s"
)
logger = logging.getLogger(__name__)

PIPELINE_DIR = Path(__file__).resolve().parents[1]


class Fetcher(ABC):
    _DIR = None

    @abstractmethod
    def fetch(self) -> list[Path]: ...


class ClimateClient:
    _BASE_URL = "https://www.climateservices.ie/"
    _ROOT = PIPELINE_DIR
    _TIMEOUT = 60
    _CHUNK_SIZE = 1 << 16

    def __init__(self):
        retry = Retry(
            total=3, backoff_factor=2, status_forcelist=[429, 500, 502, 503, 504]
        )
        self._session = requests.Session()
        self._session.mount("https://", HTTPAdapter(max_retries=retry))

    def download(self, url_path: str, folder: str | Path) -> Path:
        abs_folder = self._ROOT / folder
        abs_folder.mkdir(parents=True, exist_ok=True)

        path = abs_folder / Path(url_path).name
        if path.exists():
            logger.info("Already downloaded, skipping: %s", path.name)
            return path

        url = self._BASE_URL + url_path
        tmp = path.with_suffix(".part")
        logger.info("Downloading %s", url)
        try:
            with self._session.get(url, stream=True, timeout=self._TIMEOUT) as response:
                response.raise_for_status()
                with tmp.open("wb") as file:
                    for chunk in response.iter_content(chunk_size=self._CHUNK_SIZE):
                        file.write(chunk)
        except requests.RequestException as ex:
            logger.error("Download failed: %s (%s)", url, type(ex).__name__)
            raise
        tmp.replace(path)
        logger.info("Saved %s (%.1f MB)", path.name, path.stat().st_size / 1e6)
        return path

    @staticmethod
    def extract_nc(zip_path: Path, folder: Path) -> list[Path]:
        extracted = []
        with zipfile.ZipFile(zip_path) as zf:
            for member in zf.namelist():
                name = Path(member).name
                if name.endswith(".nc") and (
                    "baseline" in name or "ensmean_final" in name
                ):
                    target = folder / name
                    target.write_bytes(zf.read(member))
                    extracted.append(target)
                    logger.info("Extracted %s", target.name)
        if not extracted:
            raise ValueError(f"no baseline/ensmean .nc inside {zip_path.name}")
        return extracted


class TranslateFetcher(Fetcher):
    _DIR = "data/raw/indicators/"
    _VARIABLES = ("fd", "su", "hdd", "gsl")
    _SCENARIOS = ("rcp26", "rcp45", "rcp85")
    _PERIODS = ("2021-2050", "2071-2100")
    _SEASONS = ("ANNUAL",)

    def __init__(self, client: ClimateClient):
        self._client = client

    def fetch(self):
        files = []
        for var in self._VARIABLES:
            names = self._build_names(var)
            logger.info("%s: %d archives", var, len(names))
            folder = PIPELINE_DIR / self._DIR / var
            for name in names:
                nc_path = folder / self._nc_name(name)
                if nc_path.exists():
                    logger.info("Already extracted, skipping: %s", nc_path.name)
                    files.append(nc_path)
                    continue

                zip_path = self._client.download(f"TRANSLATE/{name}", folder)
                files.extend(self._client.extract_nc(zip_path, folder))
                zip_path.unlink()
                logger.info("Deleted %s", zip_path.name)
        return files

    @staticmethod
    def _nc_name(zip_name: str) -> str:
        return zip_name.replace("ensmid_final", "ensmean_final").replace(".zip", ".nc")

    def _build_names(self, var):
        names = []
        for season in self._SEASONS:
            names.append(f"{var}_CMIP5_baseline_1976-2005_{season}.zip")
            for scenario in self._SCENARIOS:
                for period in self._PERIODS:
                    names.append(
                        f"{var}_CMIP5_{scenario}_{period}_ensmid_final_{season}.zip"
                    )
        return names


def main():
    client = ClimateClient()
    fetcher = TranslateFetcher(client)
    files = fetcher.fetch()
    logger.info("Done: %d .nc files", len(files))


if __name__ == "__main__":
    main()
