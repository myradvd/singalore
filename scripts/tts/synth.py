import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

SAMPLE_RATE = 24000


def main() -> None:
    job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    pipeline = KPipeline(lang_code=job["lang"], repo_id="hexgrad/Kokoro-82M")
    out_dir = Path(job["outDir"])
    paragraphs = job["paragraphs"]
    for index, paragraph in enumerate(paragraphs):
        chunks = []
        for result in pipeline(paragraph, voice=job["voice"], speed=job["speed"], split_pattern=None):
            if result.audio is None:
                raise RuntimeError(f"Kokoro returned no audio for paragraph {index + 1}")
            chunks.append(result.audio.numpy())
        sf.write(out_dir / f"para-{index:03d}.wav", np.concatenate(chunks), SAMPLE_RATE, subtype="PCM_16")
        print(f"    paragraph {index + 1}/{len(paragraphs)}", flush=True)


if __name__ == "__main__":
    main()
