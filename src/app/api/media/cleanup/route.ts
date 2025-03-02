import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import fs from "fs";
import path from "path";
import { promisify } from "util";

// Convert fs callbacks to promises
const unlink = promisify(fs.unlink);
const exists = promisify(fs.exists);

/**
 * Cleanup media files after listing deletion
 * This endpoint expects an array of file URLs to delete
 */
export async function POST(request: NextRequest) {
  try {
    // Ensure user is authenticated
    const session = await getSession(request);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { files } = body;

    if (!files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: "Invalid request. Expected 'files' array." },
        { status: 400 }
      );
    }

    // Track deletion results
    const results = {
      success: 0,
      failed: 0,
      notFound: 0,
      details: [] as { path: string; status: string; error?: string }[],
    };

    // Process each file
    for (const file of files) {
      try {
        // Extract file paths from URLs or direct paths
        let filePath = "";
        
        if (file.url) {
          // Handle full URL or relative path
          const urlPath = new URL(file.url, "http://localhost").pathname;
          filePath = path.join(process.cwd(), "public", urlPath);
        }
        
        // Also handle thumbnail if present
        let thumbnailPath = "";
        if (file.thumbnail) {
          const thumbnailUrlPath = new URL(file.thumbnail, "http://localhost").pathname;
          thumbnailPath = path.join(process.cwd(), "public", thumbnailUrlPath);
        }

        // Delete main file if it exists
        if (filePath) {
          const fileExists = await exists(filePath);
          if (fileExists) {
            await unlink(filePath);
            results.success++;
            results.details.push({ path: filePath, status: "deleted" });
          } else {
            results.notFound++;
            results.details.push({ path: filePath, status: "not_found" });
          }
        }

        // Delete thumbnail if it exists
        if (thumbnailPath) {
          const thumbnailExists = await exists(thumbnailPath);
          if (thumbnailExists) {
            await unlink(thumbnailPath);
            results.success++;
            results.details.push({ path: thumbnailPath, status: "deleted" });
          } else {
            results.notFound++;
            results.details.push({ path: thumbnailPath, status: "not_found" });
          }
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          path: file.url || file.thumbnail || "unknown",
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      message: "Media cleanup completed",
      results,
    });
  } catch (error) {
    console.error("Media cleanup error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup media files" },
      { status: 500 }
    );
  }
}
