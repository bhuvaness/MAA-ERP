import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

/**
 * Vite plugin: Save PayanarssTypes API
 * POST /api/save-types  → writes updated types back to JSON files in public/data/
 */
function saveTypesPlugin(): Plugin {
    return {
        name: "save-payanarss-types",
        configureServer(server) {
            server.middlewares.use("/api/save-types", (req, res) => {
                if (req.method !== "POST") {
                    res.statusCode = 405;
                    res.end(JSON.stringify({ error: "Method not allowed" }));
                    return;
                }

                let body = "";
                req.on("data", (chunk: Buffer) => {
                    body += chunk.toString();
                });

                req.on("end", () => {
                    try {
                        const { types } = JSON.parse(body) as { types: unknown[] };

                        if (!Array.isArray(types)) {
                            res.statusCode = 400;
                            res.end(JSON.stringify({ error: "Invalid data: types must be an array" }));
                            return;
                        }

                        // Write combined types to main file
                        const mainPath = path.resolve(__dirname, "public/data/VanakkamPayanarssTypes.json");
                        const json = JSON.stringify(types, null, 2);
                        fs.writeFileSync(mainPath, json, "utf-8");

                        // Clear the secondary file to prevent duplication on reload
                        const gymPath = path.resolve(__dirname, "public/data/GymBusiness_PayanarssTypes.json");
                        if (fs.existsSync(gymPath)) {
                            fs.writeFileSync(gymPath, "[]", "utf-8");
                        }

                        console.log(`✅ Saved ${types.length} types to ${mainPath}`);

                        res.statusCode = 200;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ success: true, count: types.length }));
                    } catch (err) {
                        console.error("❌ Save failed:", err);
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: String(err) }));
                    }
                });
            });
        },
    };
}

export default defineConfig({
    server: {
        host: "::",
        port: 8080,
        hmr: {
            overlay: false,
        },
    },
    plugins: [react(), saveTypesPlugin()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});