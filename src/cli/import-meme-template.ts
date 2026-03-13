import process from "node:process";
import { parseArgs } from "node:util";
import { importWishlistMemeFromMemingWorld } from "@/src/server/meme-template-import";

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      key: { type: "string" }
    }
  });

  const key = values.key;
  if (!key) {
    process.stderr.write("Missing --key for meme import.\n");
    process.exit(2);
    return;
  }

  void (async () => {
    try {
      const result = await importWishlistMemeFromMemingWorld(key);
      process.stdout.write(
        `${JSON.stringify(
          {
            key: result.key,
            title: result.title,
            pageUrl: result.pageUrl,
            baseTemplate: result.baseTemplate?.localFilePath ?? null,
            exampleCount: result.examples.length
          },
          null,
          2
        )}\n`
      );
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    }
  })();
}

main(process.argv.slice(2));
