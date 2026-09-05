 export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method.toUpperCase();

      // ------------------------------------------------------------
      // BASIC HELPERS
      // ------------------------------------------------------------

      const json = (data, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            "cache-control": "no-store"
          }
        });

      const html = (content, status = 200) =>
        new Response(content, {
          status,
          headers: {
            "content-type": "text/html; charset=UTF-8",
            "cache-control": "no-store"
          }
        });

      const redirect = (location, status = 302) =>
        new Response(null, {
          status,
          headers: { location }
        });

      const escapeHtml = (value) => {
        return String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      const parseJson = async (request) => {
        try {
          return await request.json();
        } catch {
          return null;
        }
      };

      const slugify = (value) => {
        return String(value ?? "")
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 80) || "item";
      };

      const safeUrl = (value) => {
        if (!value) return "";
        try {
          const u = new URL(value);
          if (u.protocol === "http:" || u.protocol === "https:") {
            return u.toString();
          }
        } catch {}
        return "";
      };

      const intValue = (value, fallback = 0) => {
        const n = Number(value);
        return Number.isFinite(n) ? Math.round(n) : fallback;
      };

      const ratingValue = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(5, Math.round(n * 10) / 10));
      };

      const validReviewRating = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        if (n < 1 || n > 5) return null;
        return Math.round(n);
      };

      const makeUniqueSlug = async (table, candidate, excludeId = null) => {
        let base = slugify(candidate);
        let slug = base;
        let counter = 2;

        while (true) {
          let query = `SELECT id FROM ${table} WHERE slug = ?`;
          const params = [slug];

          if (excludeId !== null) {
            query += " AND id != ?";
            params.push(excludeId);
          }

          const result = await env.DB.prepare(query).bind(...params).first();

          if (!result) return slug;

          slug = base + "-" + counter;
          counter++;
        }
      };

      // ------------------------------------------------------------
      // AUTHENTICATION
      // ------------------------------------------------------------
      // Tastify admin authentication
      const COOKIE_NAME = "tastify_admin";
      const SESSION_LENGTH = 12 * 60 * 60 * 1000;

      const getCookie = (request, name) => {
        const header = request.headers.get("cookie") || "";

        const parts = header.split(";");

        for (const part of parts) {
          const index = part.indexOf("=");

          if (index === -1) continue;

          const key = part.slice(0, index).trim();

          if (key === name) {
            return decodeURIComponent(part.slice(index + 1).trim());
          }
        }

        return null;
      };

      const constantTimeEqual = (a, b) => {
        if (typeof a !== "string" || typeof b !== "string") return false;

        if (a.length !== b.length) return false;

        let result = 0;

        for (let i = 0; i < a.length; i++) {
          result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }

        return result === 0;
      };

      const toBase64Url = (bytes) => {
        let binary = "";

        for (const byte of bytes) {
          binary += String.fromCharCode(byte);
        }

        return btoa(binary)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/g, "");
      };

      const fromBase64Url = (value) => {
        const padded =
          value.replace(/-/g, "+").replace(/_/g, "/") +
          "=".repeat((4 - (value.length % 4)) % 4);

        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        return bytes;
      };

      const hmac = async (message) => {
        if (!env.ADMIN_SECRET) {
          throw new Error("ADMIN_SECRET is not configured");
        }

        const encoder = new TextEncoder();

        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(env.ADMIN_SECRET),
          {
            name: "HMAC",
            hash: "SHA-256"
          },
          false,
          ["sign"]
        );

        const signature = await crypto.subtle.sign(
          "HMAC",
          key,
          encoder.encode(message)
        );

        return toBase64Url(new Uint8Array(signature));
      };

      const createSession = async () => {
        const expires = Date.now() + SESSION_LENGTH;
        const payload = String(expires);
        const signature = await hmac(payload);

        return payload + "." + signature;
      };

      const verifySession = async (request) => {
        const cookie = getCookie(request, COOKIE_NAME);

        if (!cookie) return false;

        const parts = cookie.split(".");

        if (parts.length !== 2) return false;

        const expires = Number(parts[0]);

        if (!Number.isFinite(expires) || expires < Date.now()) {
          return false;
        }

        const expected = await hmac(parts[0]);

        return constantTimeEqual(parts[1], expected);
      };

      const adminRequired = async () => {
        return false;
      };

      const sameOrigin = (request) => {
        const origin = request.headers.get("origin");

        if (!origin) return true;

        return origin === new URL(request.url).origin;
      };
      // ------------------------------------------------------------
      // ADMIN LOGIN
      // ------------------------------------------------------------

      if (path === "/admin/login" && method === "POST") {
        const body = await parseJson(request);

        if (!body) {
          return json({ error: "Invalid JSON" }, 400);
        }

        if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
          return json(
            {
              error:
                "Admin secrets are not configured in Cloudflare Workers."
            },
            500
          );
        }

        if (!constantTimeEqual(String(body.password || ""), env.ADMIN_PASSWORD)) {
          return json({ error: "Incorrect password" }, 401);
        }

        const session = await createSession();

        return new Response(
          JSON.stringify({ success: true }),
          {
            status: 200,
            headers: {
              "content-type": "application/json; charset=UTF-8",
              "set-cookie":
                COOKIE_NAME +
                "=" +
                encodeURIComponent(session) +
                "; Max-Age=43200; Path=/; HttpOnly; Secure; SameSite=Lax"
            }
          }
        );
      }

      if (path === "/admin/logout" && method === "POST") {
        return new Response(
          JSON.stringify({ success: true }),
          {
            status: 200,
            headers: {
              "content-type": "application/json; charset=UTF-8",
              "set-cookie":
                COOKIE_NAME +
                "=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax"
            }
          }
        );
      }

      // ------------------------------------------------------------
      // ADMIN PAGE
      // ------------------------------------------------------------

      if (path === "/admin" && method === "GET") {
        const loggedIn = await verifySession(request);

        if (!loggedIn) {
          return html(adminLoginPage());
        }

        return html(adminDashboard());
      }

      // ------------------------------------------------------------
      // ADMIN API AUTH
      // ------------------------------------------------------------

      if (path.startsWith("/api/admin/")) {
        const loggedIn = await verifySession(request);

        if (!loggedIn) {
          return json({ error: "Unauthorized" }, 401);
        }

        if (
          ["POST", "PUT", "DELETE", "PATCH"].includes(method) &&
          !sameOrigin(request)
        ) {
          return json({ error: "Invalid origin" }, 403);
        }
      }

      // ------------------------------------------------------------
      // PUBLIC API - CITIES
      // ------------------------------------------------------------

      if (path === "/api/cities" && method === "GET") {
        const result = await env.DB
          .prepare(
            `SELECT id, name, country, slug
             FROM cities
             ORDER BY name ASC`
          )
          .all();

        return json({
          cities: result.results || []
        });
      }

      // ------------------------------------------------------------
      // PUBLIC API - RESTAURANTS
      // ------------------------------------------------------------

      if (path === "/api/restaurants" && method === "GET") {
        const search = (url.searchParams.get("search") || "").trim();
        const city = (url.searchParams.get("city") || "").trim();
        const category = (url.searchParams.get("category") || "").trim();

        let sql = `
          SELECT
            r.id,
            r.name,
            r.slug,
            r.description,
            r.area,
            r.address,
            r.phone,
            r.website,
            r.cuisine,
            r.price_range,
            r.rating,
            r.review_count,
            r.featured,
            c.name AS city_name,
            c.slug AS city_slug
          FROM restaurants r
          LEFT JOIN cities c ON c.id = r.city_id
          WHERE r.status = 'published'
        `;

        const params = [];

        if (search) {
          sql += `
            AND (
              r.name LIKE ?
              OR r.description LIKE ?
              OR r.cuisine LIKE ?
              OR r.area LIKE ?
            )
          `;

          const term = "%" + search + "%";

          params.push(term, term, term, term);
        }

        if (city) {
          sql += " AND c.slug = ?";
          params.push(city);
        }

        if (category) {
          sql += `
            AND EXISTS (
              SELECT 1
              FROM restaurant_categories rc
              WHERE rc.restaurant_id = r.id
              AND LOWER(rc.category) = LOWER(?)
            )
          `;

          params.push(category);
        }

        sql += `
          ORDER BY r.featured DESC, r.rating DESC, r.name ASC
        `;

        const result = await env.DB.prepare(sql).bind(...params).all();

        return json({
          restaurants: result.results || []
        });
      }

      // ------------------------------------------------------------
      // PUBLIC API - RECIPES
      // ------------------------------------------------------------

      if (path === "/api/recipes" && method === "GET") {
        const search = (url.searchParams.get("search") || "").trim();
        const category = (url.searchParams.get("category") || "").trim();

        let sql = `
          SELECT
            id,
            title,
            slug,
            description,
            category,
            cuisine,
            prep_minutes,
            cook_minutes,
            servings,
            difficulty,
            rating,
            featured
          FROM recipes
          WHERE status = 'published'
        `;

        const params = [];

        if (search) {
          sql += `
            AND (
              title LIKE ?
              OR description LIKE ?
              OR cuisine LIKE ?
              OR category LIKE ?
            )
          `;

          const term = "%" + search + "%";

          params.push(term, term, term, term);
        }

        if (category) {
          sql += " AND LOWER(category) = LOWER(?)";
          params.push(category);
        }

        sql += `
          ORDER BY featured DESC, rating DESC, title ASC
        `;

        const result = await env.DB.prepare(sql).bind(...params).all();

        return json({
          recipes: result.results || []
        });
      }

      // ------------------------------------------------------------
      // PUBLIC API - STORIES
      // ------------------------------------------------------------

      if (path === "/api/stories" && method === "GET") {
        const result = await env.DB
          .prepare(
            `SELECT
              id,
              title,
              slug,
              excerpt,
              author_name,
              category,
              featured,
              created_at
             FROM food_stories
             WHERE status = 'published'
             ORDER BY featured DESC, created_at DESC`
          )
          .all();

        return json({
          stories: result.results || []
        });
      }

      // ------------------------------------------------------------
      // PUBLIC API - SUBMIT REVIEW
      // ------------------------------------------------------------

      const reviewMatch = path.match(
        /^\/api\/restaurants\/([^/]+)\/reviews$/
      );

      if (reviewMatch && method === "POST") {
        const slug = decodeURIComponent(reviewMatch[1]);

        const restaurant = await env.DB
          .prepare(
            `SELECT id
             FROM restaurants
             WHERE slug = ?
             AND status = 'published'`
          )
          .bind(slug)
          .first();

        if (!restaurant) {
          return json({ error: "Restaurant not found" }, 404);
        }

        const body = await parseJson(request);

        if (!body) {
          return json({ error: "Invalid JSON" }, 400);
        }

        const authorName = String(body.author_name || "").trim();
        const authorEmail = String(body.author_email || "").trim();
        const title = String(body.title || "").trim();
        const reviewBody = String(body.body || "").trim();

        const overallRating = validReviewRating(body.overall_rating);

        if (!authorName || !reviewBody || overallRating === null) {
          return json(
            {
              error:
                "Name, review text and a rating from 1 to 5 are required."
            },
            400
          );
        }

        const foodRating =
          validReviewRating(body.food_rating) === null
            ? null
            : validReviewRating(body.food_rating);

        const serviceRating =
          validReviewRating(body.service_rating) === null
            ? null
            : validReviewRating(body.service_rating);

        const atmosphereRating =
          validReviewRating(body.atmosphere_rating) === null
            ? null
            : validReviewRating(body.atmosphere_rating);

        const valueRating =
          validReviewRating(body.value_rating) === null
            ? null
            : validReviewRating(body.value_rating);

        await env.DB
          .prepare(
            `INSERT INTO reviews
            (
              restaurant_id,
              author_name,
              author_email,
              title,
              body,
              overall_rating,
              food_rating,
              service_rating,
              atmosphere_rating,
              value_rating,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
          )
          .bind(
            restaurant.id,
            authorName,
            authorEmail,
            title,
            reviewBody,
            overallRating,
            foodRating,
            serviceRating,
            atmosphereRating,
            valueRating
          )
          .run();

        return json(
          {
            success: true,
            message: "Thank you. Your review has been submitted for moderation."
          },
          201
        );
      }

      // ------------------------------------------------------------
      // RESTAURANT DETAIL PAGE
      // ------------------------------------------------------------

      const restaurantPageMatch = path.match(/^\/restaurant\/([^/]+)$/);

      if (restaurantPageMatch && method === "GET") {
        const slug = decodeURIComponent(restaurantPageMatch[1]);

        const restaurant = await env.DB
          .prepare(
            `SELECT
              r.*,
              c.name AS city_name,
              c.slug AS city_slug
             FROM restaurants r
             LEFT JOIN cities c ON c.id = r.city_id
             WHERE r.slug = ?
             AND r.status = 'published'`
          )
          .bind(slug)
          .first();

        if (!restaurant) {
          return html(notFoundPage("Restaurant not found"), 404);
        }

        const reviews = await env.DB
          .prepare(
            `SELECT
              id,
              author_name,
              title,
              body,
              overall_rating,
              food_rating,
              service_rating,
              atmosphere_rating,
              value_rating,
              created_at
             FROM reviews
             WHERE restaurant_id = ?
             AND status = 'approved'
             ORDER BY created_at DESC`
          )
          .bind(restaurant.id)
          .all();

        const categories = await env.DB
          .prepare(
            `SELECT category
             FROM restaurant_categories
             WHERE restaurant_id = ?
             ORDER BY category`
          )
          .bind(restaurant.id)
          .all();

        const photos = await env.DB
          .prepare(
            `SELECT image_url, caption
             FROM restaurant_photos
             WHERE restaurant_id = ?
             ORDER BY sort_order, id`
          )
          .bind(restaurant.id)
          .all();

        return html(
          restaurantPage(
            restaurant,
            categories.results || [],
            reviews.results || [],
            photos.results || []
          )
        );
      }

      // ------------------------------------------------------------
      // RECIPE DETAIL PAGE
      // ------------------------------------------------------------

      const recipePageMatch = path.match(/^\/recipe\/([^/]+)$/);

      if (recipePageMatch && method === "GET") {
        const slug = decodeURIComponent(recipePageMatch[1]);

        const recipe = await env.DB
          .prepare(
            `SELECT *
             FROM recipes
             WHERE slug = ?
             AND status = 'published'`
          )
          .bind(slug)
          .first();

        if (!recipe) {
          return html(notFoundPage("Recipe not found"), 404);
        }

        const ingredients = await env.DB
          .prepare(
            `SELECT ingredient, quantity
             FROM recipe_ingredients
             WHERE recipe_id = ?
             ORDER BY sort_order, id`
          )
          .bind(recipe.id)
          .all();

        const steps = await env.DB
          .prepare(
            `SELECT step_number, instruction
             FROM recipe_steps
             WHERE recipe_id = ?
             ORDER BY step_number, id`
          )
          .bind(recipe.id)
          .all();

        return html(
          recipePage(
            recipe,
            ingredients.results || [],
            steps.results || []
          )
        );
      }

      // ------------------------------------------------------------
      // STORY DETAIL PAGE
      // ------------------------------------------------------------

      const storyPageMatch = path.match(/^\/story\/([^/]+)$/);

      if (storyPageMatch && method === "GET") {
        const slug = decodeURIComponent(storyPageMatch[1]);

        const story = await env.DB
          .prepare(
            `SELECT *
             FROM food_stories
             WHERE slug = ?
             AND status = 'published'`
          )
          .bind(slug)
          .first();

        if (!story) {
          return html(notFoundPage("Story not found"), 404);
        }

        return html(storyPage(story));
      }

      // ============================================================
      // ADMIN API - STATS
      // ============================================================

      if (path === "/api/admin/stats" && method === "GET") {
        const restaurants = await env.DB
          .prepare("SELECT COUNT(*) AS count FROM restaurants")
          .first();

        const recipes = await env.DB
          .prepare("SELECT COUNT(*) AS count FROM recipes")
          .first();

        const stories = await env.DB
          .prepare("SELECT COUNT(*) AS count FROM food_stories")
          .first();

        const reviews = await env.DB
          .prepare(
            `SELECT COUNT(*) AS count
             FROM reviews
             WHERE status = 'pending'`
          )
          .first();

        const cities = await env.DB
          .prepare("SELECT COUNT(*) AS count FROM cities")
          .first();

        return json({
          restaurants: restaurants?.count || 0,
          recipes: recipes?.count || 0,
          stories: stories?.count || 0,
          pending_reviews: reviews?.count || 0,
          cities: cities?.count || 0
        });
      }

      // ============================================================
      // ADMIN API - REVIEWS
      // ============================================================

      if (path === "/api/admin/reviews" && method === "GET") {
        const status = url.searchParams.get("status") || "pending";

        const allowedStatuses = ["pending", "approved", "rejected", "all"];

        if (!allowedStatuses.includes(status)) {
          return json({ error: "Invalid status" }, 400);
        }

        let sql = `
          SELECT
            rv.*,
            r.name AS restaurant_name,
            r.slug AS restaurant_slug
          FROM reviews rv
          JOIN restaurants r ON r.id = rv.restaurant_id
        `;

        const params = [];

        if (status !== "all") {
          sql += " WHERE rv.status = ?";
          params.push(status);
        }

        sql += " ORDER BY rv.created_at DESC";

        const result = await env.DB.prepare(sql).bind(...params).all();

        return json({
          reviews: result.results || []
        });
      }

      const approveMatch = path.match(
        /^\/api\/admin\/reviews\/(\d+)\/approve$/
      );

      const rejectMatch = path.match(
        /^\/api\/admin\/reviews\/(\d+)\/reject$/
      );

      if (approveMatch && method === "POST") {
        const reviewId = Number(approveMatch[1]);

        const review = await env.DB
          .prepare(
            `SELECT
              rv.*,
              r.rating AS old_rating,
              r.review_count AS old_count
             FROM reviews rv
             JOIN restaurants r ON r.id = rv.restaurant_id
             WHERE rv.id = ?`
          )
          .bind(reviewId)
          .first();

        if (!review) {
          return json({ error: "Review not found" }, 404);
        }

        if (review.status === "approved") {
          return json({ success: true, message: "Already approved" });
        }

        const before = await env.DB
          .prepare(
            `SELECT
              COUNT(*) AS count,
              COALESCE(SUM(overall_rating), 0) AS sum
             FROM reviews
             WHERE restaurant_id = ?
             AND status = 'approved'`
          )
          .bind(review.restaurant_id)
          .first();

        await env.DB
          .prepare(
            `UPDATE reviews
             SET status = 'approved'
             WHERE id = ?`
          )
          .bind(reviewId)
          .run();

        const after = await env.DB
          .prepare(
            `SELECT
              COUNT(*) AS count,
              COALESCE(SUM(overall_rating), 0) AS sum
             FROM reviews
             WHERE restaurant_id = ?
             AND status = 'approved'`
          )
          .bind(review.restaurant_id)
          .first();

        const oldRating = Number(review.old_rating || 0);
        const oldCount = Number(review.old_count || 0);

        const approvedBeforeCount = Number(before?.count || 0);
        const approvedBeforeSum = Number(before?.sum || 0);

        const approvedAfterCount = Number(after?.count || 0);
        const approvedAfterSum = Number(after?.sum || 0);

        const legacyCount = Math.max(
          oldCount - approvedBeforeCount,
          0
        );

        const legacySum =
          oldRating * oldCount - approvedBeforeSum;

        const totalCount =
          legacyCount + approvedAfterCount;

        const totalSum =
          legacySum + approvedAfterSum;

        const newRating =
          totalCount > 0
            ? Math.round((totalSum / totalCount) * 10) / 10
            : 0;

        await env.DB
          .prepare(
            `UPDATE restaurants
             SET rating = ?,
                 review_count = ?
             WHERE id = ?`
          )
          .bind(
            newRating,
            totalCount,
            review.restaurant_id
          )
          .run();

        return json({
          success: true,
          rating: newRating,
          review_count: totalCount
        });
      }

      if (rejectMatch && method === "POST") {
        const reviewId = Number(rejectMatch[1]);

        const review = await env.DB
          .prepare(
            `SELECT
              rv.*,
              r.rating AS old_rating,
              r.review_count AS old_count
             FROM reviews rv
             JOIN restaurants r ON r.id = rv.restaurant_id
             WHERE rv.id = ?`
          )
          .bind(reviewId)
          .first();

        if (!review) {
          return json({ error: "Review not found" }, 404);
        }

        const wasApproved = review.status === "approved";

        if (wasApproved) {
          const approvedBefore = await env.DB
            .prepare(
              `SELECT
                COUNT(*) AS count,
                COALESCE(SUM(overall_rating), 0) AS sum
               FROM reviews
               WHERE restaurant_id = ?
               AND status = 'approved'`
            )
            .bind(review.restaurant_id)
            .first();

          await env.DB
            .prepare(
              `UPDATE reviews
               SET status = 'rejected'
               WHERE id = ?`
            )
            .bind(reviewId)
            .run();

          const approvedAfter = await env.DB
            .prepare(
              `SELECT
                COUNT(*) AS count,
                COALESCE(SUM(overall_rating), 0) AS sum
               FROM reviews
               WHERE restaurant_id = ?
               AND status = 'approved'`
            )
            .bind(review.restaurant_id)
            .first();

          const oldRating = Number(review.old_rating || 0);
          const oldCount = Number(review.old_count || 0);

          const legacyCount = Math.max(
            oldCount - Number(approvedBefore?.count || 0),
            0
          );

          const legacySum =
            oldRating * oldCount -
            Number(approvedBefore?.sum || 0);

          const totalCount =
            legacyCount + Number(approvedAfter?.count || 0);

          const totalSum =
            legacySum + Number(approvedAfter?.sum || 0);

          const newRating =
            totalCount > 0
              ? Math.round((totalSum / totalCount) * 10) / 10
              : 0;

          await env.DB
            .prepare(
              `UPDATE restaurants
               SET rating = ?,
                   review_count = ?
               WHERE id = ?`
            )
            .bind(
              newRating,
              totalCount,
              review.restaurant_id
            )
            .run();

          return json({
            success: true,
            rating: newRating,
            review_count: totalCount
          });
        }

        await env.DB
          .prepare(
            `UPDATE reviews
             SET status = 'rejected'
             WHERE id = ?`
          )
          .bind(reviewId)
          .run();

        return json({ success: true });
      }

      // ============================================================
      // ADMIN API - RESTAURANTS
      // ============================================================

      if (path === "/api/admin/restaurants" && method === "GET") {
        const result = await env.DB
          .prepare(
            `SELECT
              r.*,
              c.name AS city_name
             FROM restaurants r
             LEFT JOIN cities c ON c.id = r.city_id
             ORDER BY r.created_at DESC, r.name ASC`
          )
          .all();

        return json({
          restaurants: result.results || []
        });
      }

      if (path === "/api/admin/restaurants" && method === "POST") {
        const body = await parseJson(request);

        if (!body) {
          return json({ error: "Invalid JSON" }, 400);
        }

        const name = String(body.name || "").trim();

        if (!name) {
          return json({ error: "Restaurant name is required" }, 400);
        }

        const slug = await makeUniqueSlug(
          "restaurants",
          body.slug || name
        );

        const cityId =
          body.city_id === "" ||
          body.city_id === null ||
          body.city_id === undefined
            ? null
            : intValue(body.city_id, 0) || null;

        const description = String(body.description || "").trim();
        const area = String(body.area || "").trim();
        const address = String(body.address || "").trim();
        const phone = String(body.phone || "").trim();
        const website = safeUrl(String(body.website || "").trim());
        const cuisine = String(body.cuisine || "").trim();
        const priceRange = String(body.price_range || "").trim();
        const rating = ratingValue(body.rating);
        const reviewCount = Math.max(0, intValue(body.review_count));
        const featured = body.featured ? 1 : 0;

        const status =
          body.status === "draft" ? "draft" : "published";

        const result = await env.DB
          .prepare(
            `INSERT INTO restaurants
            (
              name,
              slug,
              description,
              city_id,
              area,
              address,
              phone,
              website,
              cuisine,
              price_range,
              rating,
              review_count,
              featured,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            name,
            slug,
            description,
            cityId,
            area,
            address,
            phone,
            website,
            cuisine,
            priceRange,
            rating,
            reviewCount,
            featured,
            status
          )
          .run();

        const id = result.meta?.last_row_id;

        await replaceRestaurantCategories(env, id, body.categories);

        return json(
          {
            success: true,
            id,
            slug
          },
          201
        );
      }

      const restaurantAdminMatch = path.match(
        /^\/api\/admin\/restaurants\/(\d+)$/
      );

      if (restaurantAdminMatch && method === "PUT") {
        const id = Number(restaurantAdminMatch[1]);

        const existing = await env.DB
          .prepare(
            `SELECT id
             FROM restaurants
             WHERE id = ?`
          )
          .bind(id)
          .first();

        if (!existing) {
          return json({ error: "Restaurant not found" }, 404);
        }

        const body = await parseJson(request);

        if (!body) {
          return json({ error: "Invalid JSON" }, 400);
        }

        const name = String(body.name || "").trim();

        if (!name) {
          return json({ error: "Restaurant name is required" }, 400);
        }

        const slug = await makeUniqueSlug(
          "restaurants",
          body.slug || name,
          id
        );

        const cityId =
          body.city_id === "" ||
          body.city_id === null ||
          body.city_id === undefined
            ? null
            : intValue(body.city_id, 0) || null;

        await env.DB
          .prepare(
            `UPDATE restaurants
             SET
              name = ?,
              slug = ?,
              description = ?,
              city_id = ?,
              area = ?,
              address = ?,
              phone = ?,
              website = ?,
              cuisine = ?,
              price_range = ?,
              rating = ?,
              review_count = ?,
              featured = ?,
              status = ?
             WHERE id = ?`
          )
          .bind(
            name,
            slug,
            String(body.description || "").trim(),
            cityId,
            String(body.area || "").trim(),
            String(body.address || "").trim(),
            String(body.phone || "").trim(),
            safeUrl(String(body.website || "").trim()),
            String(body.cuisine || "").trim(),
            String(body.price_range || "").trim(),
            ratingValue(body.rating),
            Math.max(0, intValue(body.review_count)),
            body.featured ? 1 : 0,
            body.status === "draft" ? "draft" : "published",
            id
          )
          .run();

        await replaceRestaurantCategories(env, id, body.categories);

        return json({
          success: true,
          id,
          slug
        });
      }

      if (restaurantAdminMatch && method === "DELETE") {
        const id = Number(restaurantAdminMatch[1]);

        await env.DB
          .prepare(
            `DELETE FROM restaurants
             WHERE id = ?`
          )
          .bind(id)
          .run();

        return json({ success: true });
      }

      // ============================================================
      // ADMIN API - CITIES
      // ============================================================

      if (path === "/api/admin/cities" && method === "GET") {
        const result = await env.DB
          .prepare(
            `SELECT *
             FROM cities
             ORDER BY name ASC`
          )
          .all();

        return json({
          cities: result.results || []
        });
      }

      if (path === "/api/admin/cities" && method === "POST") {
        const body = await parseJson(request);

        if (!body) {
          return json({ error: "Invalid JSON" }, 400);
        }

        const name = String(body.name || "").trim();

        if (!name) {
          return json({ error: "City name is required" }, 400);
        }

        const slug = await makeUniqueSlug(
          "cities",
          body.slug || name
        );

        await env.DB
          .prepare(
            `INSERT INTO cities
            (name, country, slug)
            VALUES (?, ?, ?)`
          )
          .bind(
            name,
            String(body.country || "Pakistan").trim(),
            slug
          )
          .run();

        return json(
          {
            success: true,
            slug
          },
          201
        );
      }

      // ============================================================
      // ADMIN API - RECIPES
      // ============================================================

      if (path === "/api/admin/recipes" && method === "GET") {
        const result = await env.DB
          .prepare(
            `SELECT *
             FROM recipes
             ORDER BY created_at DESC, title ASC`
          )
          .all();

        return json({
          recipes: result.results || []
        });
      }

      if (path === "/api/admin/recipes" && method === "POST") {
        const body = await parseJson(request);

        if (!body) {
          return json({ error: "Invalid JSON" }, 400);
        }

        const title = String(body.title || "").trim();

        if (!title) {
          return json({ error: "Recipe title is required" }, 400);
        }

        const slug = await makeUniqueSlug(
          "recipes",
          body.slug || title
        );

        const result = await env.DB
          .prepare(
            `INSERT INTO recipes
            (
              title,
              slug,
              description,
              category,
              cuisine,
              prep_minutes,
              cook_minutes,
              servings,
              difficulty,
              rating,
              featured,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            title,
            slug,
            String(body.description || "").trim(),
            String(body.category || "").trim(),
            String(body.cuisine || "").trim(),
            Math.max(0, intValue(body.prep_minutes)),
            Math.max(0, intValue(body.cook_minutes)),
            Math.max(1, intValue(body.servings, 1)),
            String(body.difficulty || "Easy").trim(),
            ratingValue(body.rating),
            body.featured ? 1 : 0,
            body.status === "draft" ? "draft" : "published"
          )
          .run();

        const id = result.meta?.last_row_id;

        await replaceRecipeIngredients(env, id, body.ingredients);
        await replaceRecipeSteps(env, id, body.steps);

        return json(
          {
            success: true,
            id,
            slug
          },
          201
        );
      }

      const recipeAdminMatch = path.match(
        /^\/api\/admin\/recipes\/(\d+)$/
      );

      if (recipeAdminMatch && method === "PUT") {
        const id = Number(recipeAdminMatch[1]);

        const existing = await env.DB
          .prepare(
            `SELECT id
             FROM recipes
             WHERE id = ?`
          )
          .bind(id)
          .first();

        if (!existing) {
          return json({ error: "Recipe not found" }, 404);
        }

        const body = await parseJson(request);

        if (!body) {
          return json({ error: "Invalid JSON" }, 400);
        }

        const title = String(body.title || "").trim();

        if (!title) {
          return json({ error: "Recipe title is required" }, 400);
        }

        const slug = await makeUniqueSlug(
          "recipes",
          body.slug || title,
          id
        );

        await env.DB
          .prepare(
            `UPDATE recipes
             SET
              title = ?,
              slug = ?,
              description = ?,
              category = ?,
              cuisine = ?,
              prep_minutes = ?,
              cook_minutes = ?,
              servings = ?,
              difficulty = ?,
              rating = ?,
              featured = ?,
              status = ?
             WHERE id = ?`
          )
          .bind(
            title,
            slug,
            String(body.description || "").trim(),
            String(body.category || "").trim(),
            String(body.cuisine || "").trim(),
            Math.max(0, intValue(body.prep_minutes)),
            Math.max(0, intValue(body.cook_minutes)),
            Math.max(1, intValue(body.servings, 1)),
            String(body.difficulty || "Easy").trim(),
            ratingValue(body.rating),
            body.featured ? 1 : 0,
            body.status === "draft" ? "draft" : "published",
            id
          )
          .run();

        await replaceRecipeIngredients(env, id, body.ingredients);
        await replaceRecipeSteps(env, id, body.steps);

        return json({
          success: true,
          id,
          slug
        });
      }

      if (recipeAdminMatch && method === "DELETE") {
        const id = Number(recipeAdminMatch[1]);

        await env.DB
          .prepare(
            `DELETE FROM recipes
             WHERE id = ?`
          )
          .bind(id)
          .run();

        return json({ success: true });
      }

      // ============================================================
      // ADMIN API - STORIES
      // ============================================================

      if (path === "/api/admin/stories" && method === "GET") {
        const result = await env.DB
          .prepare(
            `SELECT *
             FROM food_stories
             ORDER BY created_at DESC, title ASC`
          )
          .all();

        return json({
          stories: result.results || []
        });
      }

      if (path === "/api/admin/stories" && method === "POST") {
        const body = await parseJson(request);

        if (!body) {
          return json({ error: "Invalid JSON" }, 400);
        }

        const title = String(body.title || "").trim();
        const content = String(body.content || "").trim();

        if (!title || !content) {
          return json(
            {
              error: "Story title and content are required"
            },
            400
          );
        }

        const slug = await makeUniqueSlug(
          "food_stories",
          body.slug || title
        );

        const result = await env.DB
          .prepare(
            `INSERT INTO food_stories
            (
              title,
              slug,
              excerpt,
              content,
              author_name,
              category,
              featured,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            title,
            slug,
            String(body.excerpt || "").trim(),
            content,
            String(body.author_name || "Tastify").trim(),
            String(body.category || "").trim(),
            body.featured ? 1 : 0,
            body.status === "draft" ? "draft" : "published"
          )
          .run();

        return json(
          {
            success: true,
            id: result.meta?.last_row_id,
            slug
          },
          201
        );
      }

      const storyAdminMatch = path.match(
        /^\/api\/admin\/stories\/(\d+)$/
      );

      if (storyAdminMatch && method === "PUT") {
        const id = Number(storyAdminMatch[1]);

        const existing = await env.DB
          .prepare(
            `SELECT id
             FROM food_stories
             WHERE id = ?`
          )
          .bind(id)
          .first();

        if (!existing) {
          return json({ error: "Story not found" }, 404);
        }

        const body = await parseJson(request);

        if (!body) {
          return json({ error: "Invalid JSON" }, 400);
        }

        const title = String(body.title || "").trim();
        const content = String(body.content || "").trim();

        if (!title || !content) {
          return json(
            {
              error: "Story title and content are required"
            },
            400
          );
        }

        const slug = await makeUniqueSlug(
          "food_stories",
          body.slug || title,
          id
        );

        await env.DB
          .prepare(
            `UPDATE food_stories
             SET
              title = ?,
              slug = ?,
              excerpt = ?,
              content = ?,
              author_name = ?,
              category = ?,
              featured = ?,
              status = ?
             WHERE id = ?`
          )
          .bind(
            title,
            slug,
            String(body.excerpt || "").trim(),
            content,
            String(body.author_name || "Tastify").trim(),
            String(body.category || "").trim(),
            body.featured ? 1 : 0,
            body.status === "draft" ? "draft" : "published",
            id
          )
          .run();

        return json({
          success: true,
          id,
          slug
        });
      }

      if (storyAdminMatch && method === "DELETE") {
        const id = Number(storyAdminMatch[1]);

        await env.DB
          .prepare(
            `DELETE FROM food_stories
             WHERE id = ?`
          )
          .bind(id)
          .run();

        return json({ success: true });
      }

      // ------------------------------------------------------------
      // 404 API
      // ------------------------------------------------------------

      if (path.startsWith("/api/")) {
        return json(
          {
            error: "API endpoint not found",
            path
          },
          404
        );
      }

      // ------------------------------------------------------------
      // HOME PAGE
      // ------------------------------------------------------------

      if (path === "/" && method === "GET") {
        return html(await publicHomePage(env, url));
      }

      if (path === "/restaurants" && method === "GET") {
        return html(await publicRestaurantListPage(env, url));
      }

      if (path === "/recipes" && method === "GET") {
        return html(await publicRecipeListPage(env, url));
      }

      if (path === "/stories" && method === "GET") {
        return html(await publicStoryListPage(env, url));
      }

      if (path === "/about" && method === "GET") {
        return html(publicAboutPage());
      }

      if (path === "/search" && method === "GET") {
        return html(await publicSearchPage(env, url));
      }

      const cityPublicMatch = path.match(/^\/city\/([^/]+)$/);
      if (cityPublicMatch && method === "GET") {
        return html(await publicCityPage(env, decodeURIComponent(cityPublicMatch[1])));
      }

      // ------------------------------------------------------------
      // UNKNOWN PAGE
      // ------------------------------------------------------------

      return html(notFoundPage("Page not found"), 404);

    } catch (error) {
      console.error("Tastify Worker Error:", error);

      const url = new URL(request.url);

      if (url.pathname.startsWith("/api/")) {
        return new Response(
          JSON.stringify({
            error: "Internal server error"
          }),
          {
            status: 500,
            headers: {
              "content-type": "application/json; charset=UTF-8"
            }
          }
        );
      }

      return new Response(
        "<h1>Tastify Error</h1><p>Something went wrong. Please try again.</p>",
        {
          status: 500,
          headers: {
            "content-type": "text/html; charset=UTF-8"
          }
        }
      );
    }
  }
};


// ================================================================
// PUBLIC SITE - RELEASE 1
// ================================================================

function publicCardImage(label, emoji) {
  return `<div class="publicCardImage"><span>${emoji}</span><small>${escapeHtml(label)}</small></div>`;
}

function publicSectionHead(kicker, title, text, href, linkText) {
  return `<div class="publicSectionHead"><div><div class="kicker">${escapeHtml(kicker)}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></div>${href ? `<a class="btn" href="${escapeHtml(href)}">${escapeHtml(linkText || "Explore")}</a>` : ""}</div>`;
}

function publicRestaurantCard(r) {
  return `<article class="publicCard">
    ${publicCardImage(r.cuisine || "Restaurant", "­ЪЇй№ИЈ")}
    <div class="publicCardBody">
      <div class="eyebrow">${escapeHtml(r.city_name || r.city || "Pakistan")}${r.area ? " ┬и " + escapeHtml(r.area) : ""}</div>
      <h3><a href="/restaurant/${encodeURIComponent(r.slug)}">${escapeHtml(r.name)}</a></h3>
      <div class="rating">РўЁ ${Number(r.rating || 0).toFixed(1)} <span>(${Number(r.review_count || 0)} reviews)</span></div>
      <p>${escapeHtml(r.description || "Discover this place with Tastify.")}</p>
      <div class="tagRow"><span class="tag">${escapeHtml(r.cuisine || "Food")}</span>${r.price_range ? `<span class="tag">${escapeHtml(r.price_range)}</span>` : ""}</div>
      <a class="textLink" href="/restaurant/${encodeURIComponent(r.slug)}">View restaurant Рєњ</a>
    </div>
  </article>`;
}

function publicRecipeCard(r) {
  const total = Number(r.prep_minutes || 0) + Number(r.cook_minutes || 0);
  return `<article class="publicCard">
    ${publicCardImage(r.category || "Recipe", "­ЪЦў")}
    <div class="publicCardBody">
      <div class="eyebrow">${escapeHtml(r.cuisine || "Home Cooking")} ┬и ${escapeHtml(r.difficulty || "Easy")}</div>
      <h3><a href="/recipe/${encodeURIComponent(r.slug)}">${escapeHtml(r.title)}</a></h3>
      <div class="rating">РўЁ ${Number(r.rating || 0).toFixed(1)} <span>┬и ${total} min</span></div>
      <p>${escapeHtml(r.description || "A simple Tastify recipe for home cooks.")}</p>
      <a class="textLink" href="/recipe/${encodeURIComponent(r.slug)}">View recipe Рєњ</a>
    </div>
  </article>`;
}

function publicStoryCard(s) {
  return `<article class="publicCard storyCard">
    ${publicCardImage(s.category || "Food Story", "Рюд")}
    <div class="publicCardBody">
      <div class="eyebrow">${escapeHtml(s.category || "Food Story")}</div>
      <h3><a href="/story/${encodeURIComponent(s.slug)}">${escapeHtml(s.title)}</a></h3>
      <p>${escapeHtml(s.excerpt || "A story from the world of food and culture.")}</p>
      <div class="byline">By ${escapeHtml(s.author_name || "Tastify")}</div>
      <a class="textLink" href="/story/${encodeURIComponent(s.slug)}">Read story Рєњ</a>
    </div>
  </article>`;
}

function publicFilterBar(action, fields, url) {
  return `<form class="publicFilters" method="GET" action="${escapeHtml(action)}">
    <input name="q" value="${escapeHtml(url.searchParams.get("q") || "")}" placeholder="Search Tastify...">
    ${fields}
    <button type="submit">Search</button>
  </form>`;
}

async function publicHomePage(env, url) {
  const [cities, restaurants, recipes, stories] = await Promise.all([
    env.DB.prepare(`SELECT id,name,slug FROM cities ORDER BY name ASC`).all(),
    env.DB.prepare(`SELECT r.*, c.name AS city_name FROM restaurants r LEFT JOIN cities c ON c.id=r.city_id WHERE r.status='published' ORDER BY r.featured DESC,r.rating DESC,r.name ASC LIMIT 6`).all(),
    env.DB.prepare(`SELECT * FROM recipes WHERE status='published' ORDER BY featured DESC,rating DESC,title ASC LIMIT 6`).all(),
    env.DB.prepare(`SELECT * FROM food_stories WHERE status='published' ORDER BY featured DESC,created_at DESC LIMIT 3`).all()
  ]);
  const cityOptions=(cities.results||[]).map(c=>`<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("");
  const rs=restaurants.results||[], rec=recipes.results||[], st=stories.results||[];
  const content=`
  <section class="publicHero"><div class="container heroGrid">
    <div><div class="kicker light">FOOD ┬и DISCOVERY ┬и STORIES</div><h1>Discover <em>With Tastify</em></h1><p class="heroLead">Recipes to cook. Places to discover. Stories to savor.</p>
      <div class="heroActions"><a class="btn heroBtn" href="/recipes">Explore Recipes</a><a class="btn outlineBtn" href="/restaurants">Discover Restaurants</a></div>
      <form class="heroSearch" method="GET" action="/search"><input name="q" placeholder="Search recipes, restaurants, cuisines..." aria-label="Search Tastify"><button type="submit">Search</button></form>
    </div>
    <div class="heroArt"><div class="plate">Рюд</div><span>Cook ┬и Discover ┬и Savor</span></div>
  </div></section>
  <section class="section"><div class="container">${publicSectionHead("TASTIFY KITCHEN","Recipes Worth Making","Easy recipes designed for real home cooks.","/recipes","View all recipes")}<div class="publicGrid">${rec.map(publicRecipeCard).join("") || `<div class="empty">Recipes are coming soon.</div>`}</div></div></section>
  <section class="section altSection"><div class="container">${publicSectionHead("DISCOVER","Places Worth Finding","Explore restaurants by city, cuisine and rating.","/restaurants","Explore restaurants")}<div class="publicGrid">${rs.map(publicRestaurantCard).join("") || `<div class="empty">Restaurant listings are coming soon.</div>`}</div></div></section>
  <section class="section"><div class="container">${publicSectionHead("FROM THE TABLE","Food Stories","The people, places, traditions and ideas behind what we eat.","/stories","Read all stories")}<div class="publicGrid storiesGrid">${st.map(publicStoryCard).join("") || `<div class="empty">Food stories are coming soon.</div>`}</div></div></section>
  <section class="cityStrip"><div class="container"><div><div class="kicker">DISCOVER BY CITY</div><h2>Start somewhere delicious.</h2></div><div class="cityLinks">${(cities.results||[]).map(c=>`<a href="/city/${encodeURIComponent(c.slug)}">${escapeHtml(c.name)} <span>Рєњ</span></a>`).join("") || "<span>No cities yet.</span>"}</div></div></section>
  <section class="manifesto"><div class="container"><div class="kicker">THE TASTIFY IDEA</div><h2>In the realms where food and art unite,<br><em>we aspire to be magicians.</em></h2><p>Tastify brings recipes, places and stories together so food feels like more than a meal.</p></div></section>`;
  return pageShell("Discover With Tastify",content);
}

async function publicRestaurantListPage(env,url) {
  const q=String(url.searchParams.get("q")||"").trim(), city=String(url.searchParams.get("city")||"").trim(), cuisine=String(url.searchParams.get("cuisine")||"").trim();
  let sql=`SELECT r.*,c.name AS city_name,c.slug AS city_slug FROM restaurants r LEFT JOIN cities c ON c.id=r.city_id WHERE r.status='published'`, args=[];
  if(q){sql+=` AND (r.name LIKE ? OR r.description LIKE ? OR r.cuisine LIKE ? OR r.area LIKE ?)`;const x=`%${q}%`;args.push(x,x,x,x)}
  if(city){sql+=` AND c.slug=?`;args.push(city)}
  if(cuisine){sql+=` AND r.cuisine LIKE ?`;args.push(`%${cuisine}%`)}
  sql+=` ORDER BY r.featured DESC,r.rating DESC,r.name ASC`;
  const [rows,cities]=await Promise.all([env.DB.prepare(sql).bind(...args).all(),env.DB.prepare(`SELECT name,slug FROM cities ORDER BY name`).all()]);
  const cityOpts=(cities.results||[]).map(c=>`<option value="${escapeHtml(c.slug)}" ${city===c.slug?"selected":""}>${escapeHtml(c.name)}</option>`).join("");
  const content=`<section class="introBand"><div class="container"><div class="kicker">TASTIFY DISCOVERY</div><h1>Restaurants</h1><p>Find places worth eating at Рђћ from familiar favorites to new discoveries.</p></div></section><section class="section"><div class="container">${publicFilterBar("/restaurants",`<select name="city"><option value="">All cities</option>${cityOpts}</select><input name="cuisine" value="${escapeHtml(cuisine)}" placeholder="Cuisine">`,url)}<div class="publicGrid">${(rows.results||[]).map(publicRestaurantCard).join("")||`<div class="empty">No restaurants matched your search.</div>`}</div></div></section>`;
  return pageShell("Restaurants",content);
}

async function publicRecipeListPage(env,url) {
  const q=String(url.searchParams.get("q")||"").trim(), category=String(url.searchParams.get("category")||"").trim();
  let sql=`SELECT * FROM recipes WHERE status='published'`,args=[];
  if(q){sql+=` AND (title LIKE ? OR description LIKE ? OR cuisine LIKE ? OR category LIKE ?)`;const x=`%${q}%`;args.push(x,x,x,x)}
  if(category){sql+=` AND LOWER(category)=LOWER(?)`;args.push(category)}
  sql+=` ORDER BY featured DESC,rating DESC,title ASC`;
  const rows=await env.DB.prepare(sql).bind(...args).all();
  const cats=await env.DB.prepare(`SELECT DISTINCT category FROM recipes WHERE status='published' AND category IS NOT NULL AND category!='' ORDER BY category`).all();
  const opts=(cats.results||[]).map(c=>`<option value="${escapeHtml(c.category)}" ${category.toLowerCase()===String(c.category).toLowerCase()?"selected":""}>${escapeHtml(c.category)}</option>`).join("");
  const content=`<section class="introBand"><div class="container"><div class="kicker">TASTIFY KITCHEN</div><h1>Recipes</h1><p>Simple ideas, useful techniques and recipes made for home cooks.</p></div></section><section class="section"><div class="container">${publicFilterBar("/recipes",`<select name="category"><option value="">All categories</option>${opts}</select>`,url)}<div class="publicGrid">${(rows.results||[]).map(publicRecipeCard).join("")||`<div class="empty">No recipes matched your search.</div>`}</div></div></section>`;
  return pageShell("Recipes",content);
}

async function publicStoryListPage(env,url) {
  const q=String(url.searchParams.get("q")||"").trim();
  let sql=`SELECT * FROM food_stories WHERE status='published'`,args=[];
  if(q){sql+=` AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ? OR category LIKE ?)`;const x=`%${q}%`;args.push(x,x,x,x)}
  sql+=` ORDER BY featured DESC,created_at DESC`;
  const rows=await env.DB.prepare(sql).bind(...args).all();
  const content=`<section class="introBand"><div class="container"><div class="kicker">FROM THE TABLE</div><h1>Food Stories</h1><p>Stories about food, culture, places and the people who make every table interesting.</p></div></section><section class="section"><div class="container">${publicFilterBar("/stories","",url)}<div class="publicGrid storiesGrid">${(rows.results||[]).map(publicStoryCard).join("")||`<div class="empty">No stories matched your search.</div>`}</div></div></section>`;
  return pageShell("Food Stories",content);
}

async function publicSearchPage(env,url) {
  const q=String(url.searchParams.get("q")||"").trim();
  if(!q) return pageShell("Search",`<section class="introBand"><div class="container"><div class="kicker">TASTIFY SEARCH</div><h1>Search Tastify</h1><p>Find a recipe, restaurant or food story.</p>${publicFilterBar("/search","",url)}</div></section>`);
  const x=`%${q}%`;
  const [r,rec,s]=await Promise.all([
    env.DB.prepare(`SELECT r.*,c.name AS city_name FROM restaurants r LEFT JOIN cities c ON c.id=r.city_id WHERE r.status='published' AND (r.name LIKE ? OR r.description LIKE ? OR r.cuisine LIKE ? OR r.area LIKE ?) ORDER BY r.rating DESC LIMIT 12`).bind(x,x,x,x).all(),
    env.DB.prepare(`SELECT * FROM recipes WHERE status='published' AND (title LIKE ? OR description LIKE ? OR cuisine LIKE ? OR category LIKE ?) ORDER BY rating DESC LIMIT 12`).bind(x,x,x,x).all(),
    env.DB.prepare(`SELECT * FROM food_stories WHERE status='published' AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ? OR category LIKE ?) ORDER BY created_at DESC LIMIT 12`).bind(x,x,x,x).all()
  ]);
  const content=`<section class="introBand"><div class="container"><div class="kicker">TASTIFY SEARCH</div><h1>Results for Рђю${escapeHtml(q)}РђЮ</h1>${publicFilterBar("/search","",url)}</div></section><section class="section"><div class="container"><h2 class="resultTitle">Restaurants</h2><div class="publicGrid">${(r.results||[]).map(publicRestaurantCard).join("")||`<div class="empty">No restaurant results.</div>`}</div><h2 class="resultTitle">Recipes</h2><div class="publicGrid">${(rec.results||[]).map(publicRecipeCard).join("")||`<div class="empty">No recipe results.</div>`}</div><h2 class="resultTitle">Food Stories</h2><div class="publicGrid">${(s.results||[]).map(publicStoryCard).join("")||`<div class="empty">No story results.</div>`}</div></div></section>`;
  return pageShell("Search",content);
}

async function publicCityPage(env,slug) {
  const city=await env.DB.prepare(`SELECT * FROM cities WHERE slug=?`).bind(slug).first();
  if(!city) return notFoundPage("City not found");
  const rows=await env.DB.prepare(`SELECT r.*,c.name AS city_name FROM restaurants r LEFT JOIN cities c ON c.id=r.city_id WHERE r.status='published' AND c.slug=? ORDER BY r.featured DESC,r.rating DESC,r.name`).bind(slug).all();
  const content=`<section class="introBand"><div class="container"><div class="kicker">DISCOVER BY CITY</div><h1>${escapeHtml(city.name)}</h1><p>Restaurants and food discoveries in ${escapeHtml(city.name)}.</p></div></section><section class="section"><div class="container"><div class="publicGrid">${(rows.results||[]).map(publicRestaurantCard).join("")||`<div class="empty">No restaurants have been added for this city yet.</div>`}</div></div></section>`;
  return pageShell(city.name,content);
}

function publicAboutPage(){
  return pageShell("About Tastify",`<section class="introBand"><div class="container"><div class="kicker">ABOUT TASTIFY</div><h1>Food is more than a meal.</h1><p>It is a place, a memory, a technique, a conversation and sometimes a little bit of magic.</p></div></section><section class="section"><div class="container aboutCopy"><h2>Why Tastify?</h2><p>Tastify is built around three simple ideas: help home cooks make something delicious, help people discover places worth visiting, and tell the stories that make food meaningful.</p><p>We are building a food destination where practical recipes meet thoughtful discovery and editorial storytelling.</p><div class="aboutQuote">РђюIn the realms where food and art unite, we aspire to be magicians.РђЮ</div></div></section>`);
}

// ================================================================
// DATABASE HELPERS
// ================================================================

async function replaceRestaurantCategories(env, id, categories) {
  if (!id) return;

  const values = Array.isArray(categories)
    ? categories
    : String(categories || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

  await env.DB
    .prepare(
      `DELETE FROM restaurant_categories
       WHERE restaurant_id = ?`
    )
    .bind(id)
    .run();

  for (const category of values) {
    const clean = String(category).trim();

    if (!clean) continue;

    await env.DB
      .prepare(
        `INSERT INTO restaurant_categories
        (restaurant_id, category)
        VALUES (?, ?)`
      )
      .bind(id, clean)
      .run();
  }
}

async function replaceRecipeIngredients(env, id, ingredients) {
  if (!id) return;

  await env.DB
    .prepare(
      `DELETE FROM recipe_ingredients
       WHERE recipe_id = ?`
    )
    .bind(id)
    .run();

  if (!Array.isArray(ingredients)) return;

  let order = 0;

  for (const item of ingredients) {
    let ingredient = "";
    let quantity = "";

    if (typeof item === "string") {
      ingredient = item.trim();
    } else if (item) {
      ingredient = String(item.ingredient || "").trim();
      quantity = String(item.quantity || "").trim();
    }

    if (!ingredient) continue;

    await env.DB
      .prepare(
        `INSERT INTO recipe_ingredients
        (recipe_id, ingredient, quantity, sort_order)
        VALUES (?, ?, ?, ?)`
      )
      .bind(id, ingredient, quantity, order)
      .run();

    order++;
  }
}

async function replaceRecipeSteps(env, id, steps) {
  if (!id) return;

  await env.DB
    .prepare(
      `DELETE FROM recipe_steps
       WHERE recipe_id = ?`
    )
    .bind(id)
    .run();

  if (!Array.isArray(steps)) return;

  let number = 1;

  for (const item of steps) {
    let instruction = "";

    if (typeof item === "string") {
      instruction = item.trim();
    } else if (item) {
      instruction = String(item.instruction || "").trim();
    }

    if (!instruction) continue;

    await env.DB
      .prepare(
        `INSERT INTO recipe_steps
        (recipe_id, step_number, instruction)
        VALUES (?, ?, ?)`
      )
      .bind(id, number, instruction)
      .run();

    number++;
  }
}


// ================================================================
// SHARED HTML
// ================================================================
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function pageShell(title, content, script = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} | Tastify</title>

<style>
:root{
  --green:#087f6c;
  --deep:#075c50;
  --cream:#fffaf0;
  --gold:#d8a83e;
  --orange:#f28c28;
  --ink:#17332e;
  --muted:#6c7773;
  --white:#ffffff;
  --line:#e5e1d8;
  --shadow:0 10px 35px rgba(0,0,0,.08);
}

*{
  box-sizing:border-box;
}

body{
  margin:0;
  background:var(--cream);
  color:var(--ink);
  font-family:Arial,sans-serif;
  line-height:1.6;
}

a{
  color:inherit;
  text-decoration:none;
}

.container{
  width:min(1180px,92%);
  margin:auto;
}

header{
  background:var(--green);
  color:white;
  position:sticky;
  top:0;
  z-index:50;
  box-shadow:0 3px 15px rgba(0,0,0,.12);
}

.nav{
  min-height:72px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px;
}

.logo{
  font-family:Georgia,serif;
  font-size:29px;
  font-weight:bold;
  letter-spacing:.5px;
}

.logo span{
  color:#f4d37b;
}

nav{
  display:flex;
  gap:20px;
  align-items:center;
  flex-wrap:wrap;
}

nav a{
  color:white;
  font-weight:bold;
  opacity:.95;
}

nav a:hover{
  color:#ffe4a0;
}

.hero{
  padding:75px 0;
  background:
    radial-gradient(circle at top right,rgba(216,168,62,.25),transparent 35%),
    linear-gradient(135deg,#075c50,#087f6c);
  color:white;
}

.hero h1{
  font-family:Georgia,serif;
  font-size:clamp(40px,7vw,72px);
  line-height:1.05;
  margin:0 0 18px;
  max-width:800px;
}

.hero p{
  font-size:19px;
  max-width:720px;
  opacity:.92;
}

.searchBox{
  margin-top:30px;
  background:white;
  padding:12px;
  border-radius:14px;
  display:flex;
  gap:10px;
  box-shadow:var(--shadow);
  max-width:900px;
}

.searchBox input,
.searchBox select{
  border:1px solid var(--line);
  padding:14px;
  border-radius:9px;
  min-width:0;
  flex:1;
  font-size:15px;
}

button,
.btn{
  border:0;
  background:var(--green);
  color:white;
  padding:12px 18px;
  border-radius:8px;
  cursor:pointer;
  font-weight:bold;
  display:inline-block;
}

button:hover,
.btn:hover{
  background:var(--deep);
}

.btn.gold{
  background:var(--gold);
  color:#2d2411;
}

.btn.orange{
  background:var(--orange);
}

.section{
  padding:55px 0;
}

.sectionHead{
  display:flex;
  justify-content:space-between;
  align-items:end;
  gap:20px;
  margin-bottom:25px;
}

.section h2{
  font-family:Georgia,serif;
  font-size:34px;
  margin:0;
}

.grid{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:22px;
}

.card{
  background:white;
  border:1px solid var(--line);
  border-radius:15px;
  overflow:hidden;
  box-shadow:0 5px 20px rgba(0,0,0,.05);
}

.cardBody{
  padding:20px;
}

.card h3{
  margin:0 0 8px;
  font-family:Georgia,serif;
  font-size:24px;
}

.meta{
  color:var(--muted);
  font-size:14px;
}

.rating{
  color:#9a6c00;
  font-weight:bold;
}

.cardImage{
  height:180px;
  background:linear-gradient(135deg,#087f6c,#d8a83e);
  display:flex;
  align-items:center;
  justify-content:center;
  color:white;
  font-family:Georgia,serif;
  font-size:28px;
}

.tags{
  display:flex;
  flex-wrap:wrap;
  gap:7px;
  margin:12px 0;
}

.tag{
  background:#edf6f3;
  color:var(--deep);
  border-radius:20px;
  padding:5px 10px;
  font-size:12px;
  font-weight:bold;
}

.detail{
  padding:55px 0;
}

.detailHero{
  background:white;
  border:1px solid var(--line);
  border-radius:18px;
  padding:32px;
  box-shadow:var(--shadow);
}

.detailHero h1{
  font-family:Georgia,serif;
  font-size:45px;
  line-height:1.1;
  margin:0 0 12px;
}

.review{
  background:white;
  border:1px solid var(--line);
  padding:20px;
  border-radius:12px;
  margin:15px 0;
}

form.standard{
  background:white;
  border:1px solid var(--line);
  border-radius:15px;
  padding:25px;
}

label{
  display:block;
  font-weight:bold;
  margin:12px 0 6px;
}

input,
textarea,
select{
  width:100%;
  padding:12px;
  border:1px solid #d7d2c7;
  border-radius:8px;
  font:inherit;
}

textarea{
  min-height:130px;
  resize:vertical;
}

.two{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:18px;
}

footer{
  background:#123f37;
  color:white;
  padding:40px 0;
  margin-top:40px;
}

.notice{
  background:#fff4cf;
  border:1px solid #ead08a;
  padding:15px;
  border-radius:10px;
  margin:15px 0;
}

.empty{
  padding:35px;
  background:white;
  border:1px dashed #cfc8ba;
  border-radius:12px;
  text-align:center;
  color:var(--muted);
}

.adminWrap{
  min-height:100vh;
  background:#f4f1e9;
}

.adminHeader{
  background:#075c50;
  color:white;
  padding:18px 0;
}

.adminLayout{
  display:grid;
  grid-template-columns:230px 1fr;
  min-height:calc(100vh - 70px);
}

.adminSide{
  background:#123f37;
  color:white;
  padding:20px;
}

.adminSide button{
  display:block;
  width:100%;
  text-align:left;
  margin:7px 0;
  background:transparent;
}

.adminSide button:hover{
  background:#087f6c;
}

.adminMain{
  padding:30px;
}

.statGrid{
  display:grid;
  grid-template-columns:repeat(5,1fr);
  gap:15px;
  margin-bottom:25px;
}

.stat{
  background:white;
  border:1px solid var(--line);
  border-radius:12px;
  padding:20px;
}

.stat strong{
  font-size:32px;
  display:block;
  color:var(--green);
}

.adminPanel{
  background:white;
  border:1px solid var(--line);
  border-radius:14px;
  padding:22px;
  margin-bottom:20px;
}

.adminTable{
  width:100%;
  border-collapse:collapse;
}

.adminTable th,
.adminTable td{
  border-bottom:1px solid var(--line);
  padding:11px;
  text-align:left;
  vertical-align:top;
}

.smallBtn{
  padding:7px 10px;
  font-size:12px;
  margin:2px;
}

.danger{
  background:#a33;
}

.success{
  background:#28764d;
}

@media(max-width:850px){
  .grid{
    grid-template-columns:1fr 1fr;
  }

  .adminLayout{
    grid-template-columns:1fr;
  }

  .adminSide{
    display:flex;
    overflow:auto;
    gap:6px;
  }

  .adminSide button{
    width:auto;
    white-space:nowrap;
  }

  .statGrid{
    grid-template-columns:repeat(2,1fr);
  }
}

@media(max-width:600px){
  nav{
    gap:10px;
    font-size:13px;
  }

  .nav{
    flex-direction:column;
    padding:15px 0;
  }

  .searchBox{
    flex-direction:column;
  }

  .grid{
    grid-template-columns:1fr;
  }

  .two{
    grid-template-columns:1fr;
  }

  .detailHero h1{
    font-size:34px;
  }

  .adminMain{
    padding:15px;
  }

  .statGrid{
    grid-template-columns:1fr 1fr;
  }

  .adminTable{
    font-size:12px;
  }
}

.publicHero{padding:82px 0;background:radial-gradient(circle at 82% 18%,rgba(216,168,62,.28),transparent 28%),linear-gradient(135deg,#075c50,#087f6c);color:#fff}
.heroGrid{display:grid;grid-template-columns:1.25fr .75fr;gap:40px;align-items:center}
.publicHero h1{font-family:Georgia,serif;font-size:clamp(46px,7vw,82px);line-height:.98;margin:10px 0 20px}.publicHero h1 em{color:#f4d37b;font-weight:normal}.heroLead{font-size:21px;max-width:650px;opacity:.94}.heroActions{display:flex;gap:12px;flex-wrap:wrap;margin:28px 0}.heroBtn{background:#d8a83e;color:#2d2411}.outlineBtn{background:transparent;border:1px solid rgba(255,255,255,.7)}.heroSearch{display:flex;gap:8px;background:#fff;padding:8px;border-radius:12px;max-width:720px}.heroSearch input{border:0;outline:0;padding:13px;flex:1}.heroArt{min-height:330px;border:1px solid rgba(255,255,255,.25);border-radius:28px;background:radial-gradient(circle at 50% 42%,rgba(255,255,255,.14),transparent 34%);display:flex;flex-direction:column;align-items:center;justify-content:center}.plate{width:190px;height:190px;border:2px solid #f4d37b;border-radius:50%;display:grid;place-items:center;font-size:70px;color:#f4d37b;box-shadow:0 0 0 16px rgba(255,255,255,.05),inset 0 0 40px rgba(216,168,62,.18)}.heroArt span{margin-top:20px;font-size:13px;letter-spacing:2px;text-transform:uppercase}.kicker{font-size:12px;font-weight:800;letter-spacing:2px;color:#087f6c}.kicker.light{color:#f4d37b}.publicSectionHead{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:26px}.publicSectionHead h2{font-family:Georgia,serif;font-size:38px;margin:5px 0}.publicSectionHead p{color:#6b6a63;margin:0;max-width:620px}.publicGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}.publicCard{background:#fff;border:1px solid #ded8ca;border-radius:18px;overflow:hidden;box-shadow:0 7px 24px rgba(0,0,0,.05)}.publicCardImage{height:185px;background:linear-gradient(135deg,#087f6c,#d8a83e);color:#fff;display:flex;align-items:center;justify-content:center;position:relative}.publicCardImage span{font-size:56px}.publicCardImage small{position:absolute;bottom:12px;left:15px;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;font-size:10px}.publicCardBody{padding:21px}.publicCard h3{font-family:Georgia,serif;font-size:25px;margin:7px 0}.publicCard h3 a{color:#173f38}.publicCard p{color:#66645d;line-height:1.65}.eyebrow,.byline{font-size:12px;color:#77756e}.rating{color:#9a6c00;font-weight:800}.rating span{color:#777;font-weight:500}.tagRow{display:flex;gap:7px;flex-wrap:wrap;margin:13px 0}.textLink{font-weight:800;color:#075c50}.altSection{background:#f1eee6}.section{padding:65px 0}.cityStrip{padding:48px 0;background:#123f37;color:#fff}.cityStrip .container{display:flex;justify-content:space-between;gap:30px;align-items:center}.cityStrip h2{font-family:Georgia,serif;font-size:34px;margin:7px 0}.cityLinks{display:flex;gap:10px;flex-wrap:wrap}.cityLinks a{padding:11px 14px;border:1px solid rgba(255,255,255,.22);border-radius:30px;color:#fff}.cityLinks span{color:#f4d37b}.manifesto{padding:75px 0;background:#fffaf0}.manifesto h2{font-family:Georgia,serif;font-size:clamp(34px,5vw,58px);line-height:1.1}.manifesto h2 em{color:#087f6c;font-weight:normal}.manifesto p{max-width:650px;color:#666}.introBand{padding:65px 0;background:#f1eee6}.introBand h1{font-family:Georgia,serif;font-size:56px;margin:8px 0 12px}.introBand p{font-size:19px;color:#666;max-width:700px}.publicFilters{display:flex;gap:10px;background:#fff;padding:12px;border:1px solid #ded8ca;border-radius:14px;margin-bottom:30px}.publicFilters input,.publicFilters select{flex:1;min-width:0}.resultTitle{font-family:Georgia,serif;font-size:32px;margin:38px 0 18px}.aboutCopy{max-width:820px}.aboutCopy h2{font-family:Georgia,serif;font-size:40px}.aboutCopy p{font-size:18px;line-height:1.8;color:#555}.aboutQuote{margin-top:35px;padding:28px;border-left:4px solid #d8a83e;background:#fff;font-family:Georgia,serif;font-size:25px;color:#075c50}
@media(max-width:800px){.heroGrid{grid-template-columns:1fr}.heroArt{display:none}.publicGrid{grid-template-columns:1fr 1fr}.publicSectionHead,.cityStrip .container{align-items:flex-start;flex-direction:column}.publicFilters{flex-direction:column}.introBand h1{font-size:44px}}
@media(max-width:560px){.publicGrid{grid-template-columns:1fr}.publicHero{padding:58px 0}.publicHero h1{font-size:52px}.heroSearch{flex-direction:column}.heroSearch button{width:100%}}
</style>
</head>

<body>

<header>
<div class="container nav">
<a class="logo" href="/">Tasti<span>fy</span></a>

<nav>
<a href="/">Home</a>
<a href="/restaurants">Restaurants</a>
<a href="/recipes">Recipes</a>
<a href="/stories">Food Stories</a>
<a href="/about">About</a>
<a href="/search">Search</a>
</nav>
</div>
</header>

${content}

<footer>
<div class="container">
<strong>Tastify</strong>
<p>In the realms where food and art unite, we aspire to be magicians.</p>
</div>
</footer>

${script}

</body>
</html>`;
}


// ================================================================
// HOME PAGE
// ================================================================

async function homePage(url, env) {
  const search = url.searchParams.get("search") || "";
  const city = url.searchParams.get("city") || "";

  const cities = await env.DB
    .prepare(
      `SELECT id,name,slug
       FROM cities
       ORDER BY name`
    )
    .all();

  const restaurants = await env.DB
    .prepare(
      `SELECT
        r.*,
        c.name AS city_name
       FROM restaurants r
       LEFT JOIN cities c ON c.id = r.city_id
       WHERE r.status = 'published'
       AND r.featured = 1
       ORDER BY r.rating DESC, r.name
       LIMIT 6`
    )
    .all();

  const recipes = await env.DB
    .prepare(
      `SELECT *
       FROM recipes
       WHERE status = 'published'
       ORDER BY featured DESC, rating DESC, title
       LIMIT 6`
    )
    .all();

  const stories = await env.DB
    .prepare(
      `SELECT *
       FROM food_stories
       WHERE status = 'published'
       ORDER BY featured DESC, created_at DESC
       LIMIT 3`
    )
    .all();

  const restaurantCards =
    (restaurants.results || []).length
      ? restaurants.results
          .map(
            (r) => `
<div class="card">
<div class="cardImage">Tastify</div>
<div class="cardBody">
<h3>${escapeHtml(r.name)}</h3>
<div class="meta">${escapeHtml(r.city_name || "")} ${r.area ? "┬и " + escapeHtml(r.area) : ""}</div>
<p>${escapeHtml(r.description || "Discover this food destination with Tastify.")}</p>
<div class="rating">РўЁ ${Number(r.rating || 0).toFixed(1)} ┬и ${Number(r.review_count || 0)} reviews</div>
<div class="tags">
${escapeHtml(r.cuisine || "Food")}
${r.price_range ? `<span class="tag">${escapeHtml(r.price_range)}</span>` : ""}
</div>
<a class="btn" href="/restaurant/${encodeURIComponent(r.slug)}">Explore</a>
</div>
</div>`
          )
          .join("")
      : `<div class="empty">No restaurants have been added yet.</div>`;

  const recipeCards =
    (recipes.results || []).length
      ? recipes.results
          .map(
            (r) => `
<div class="card">
<div class="cardImage">Recipe</div>
<div class="cardBody">
<h3>${escapeHtml(r.title)}</h3>
<div class="meta">${escapeHtml(r.cuisine || "")} ┬и ${escapeHtml(r.difficulty || "Easy")}</div>
<p>${escapeHtml(r.description || "")}</p>
<div class="rating">РўЁ ${Number(r.rating || 0).toFixed(1)}</div>
<a class="btn gold" href="/recipe/${encodeURIComponent(r.slug)}">View Recipe</a>
</div>
</div>`
          )
          .join("")
      : `<div class="empty">No recipes have been added yet.</div>`;

  const storyCards =
    (stories.results || []).length
      ? stories.results
          .map(
            (s) => `
<div class="card">
<div class="cardBody">
<div class="tag">${escapeHtml(s.category || "Food Story")}</div>
<h3>${escapeHtml(s.title)}</h3>
<p>${escapeHtml(s.excerpt || "")}</p>
<div class="meta">By ${escapeHtml(s.author_name || "Tastify")}</div>
<br>
<a class="btn orange" href="/story/${encodeURIComponent(s.slug)}">Read Story</a>
</div>
</div>`
          )
          .join("")
      : `<div class="empty">No food stories have been added yet.</div>`;

  const cityOptions = (cities.results || [])
    .map(
      (c) =>
        `<option value="${escapeHtml(c.slug)}" ${
          city === c.slug ? "selected" : ""
        }>${escapeHtml(c.name)}</option>`
    )
    .join("");

  const content = `
<section class="hero">
<div class="container">
<h1>Discover With Tastify</h1>
<p>
Explore restaurants, discover easy recipes, and enter the realms where food and art unite.
</p>

<form class="searchBox" method="GET" action="/">
<input
name="search"
placeholder="Search restaurants, cuisines or food..."
value="${escapeHtml(search)}"
>

<select name="city">
<option value="">All cities</option>
${cityOptions}
</select>

<button type="submit">Search</button>
</form>
</div>
</section>

<section class="section" id="restaurants">
<div class="container">
<div class="sectionHead">
<h2>Featured Restaurants</h2>
<a class="btn" href="#restaurants">Discover</a>
</div>

<div class="grid">
${restaurantCards}
</div>
</div>
</section>

<section class="section" id="recipes">
<div class="container">
<div class="sectionHead">
<h2>Easy Recipes</h2>
</div>

<div class="grid">
${recipeCards}
</div>
</div>
</section>

<section class="section" id="stories">
<div class="container">
<div class="sectionHead">
<h2>Food Stories</h2>
</div>

<div class="grid">
${storyCards}
</div>
</div>
</section>
`;

  return pageShell("Discover With Tastify", content);
}


// ================================================================
// RESTAURANT PAGE
// ================================================================

function restaurantPage(restaurant, categories, reviews, photos) {
  const tags = categories
    .map((c) => `<span class="tag">${escapeHtml(c.category)}</span>`)
    .join("");

  const photoBlock = photos.length
    ? `
<div class="grid" style="margin-top:25px">
${photos
  .map(
    (p) => `
<div class="card">
<img
src="${escapeHtml(p.image_url)}"
alt="${escapeHtml(p.caption || restaurant.name)}"
style="width:100%;height:230px;object-fit:cover"
>
</div>`
  )
  .join("")}
</div>`
    : "";

  const reviewBlock = reviews.length
    ? reviews
        .map(
          (r) => `
<div class="review">
<strong>${escapeHtml(r.author_name)}</strong>
<div class="rating">РўЁ ${Number(r.overall_rating).toFixed(0)}/5</div>
${r.title ? `<h3>${escapeHtml(r.title)}</h3>` : ""}
<p>${escapeHtml(r.body)}</p>
<div class="meta">${escapeHtml(r.created_at || "")}</div>
</div>`
        )
        .join("")
    : `<div class="empty">No approved reviews yet. Be the first to share your experience.</div>`;

  const content = `
<section class="detail">
<div class="container">

<div class="detailHero">

<div class="tag">
${escapeHtml(restaurant.cuisine || "Restaurant")}
</div>

<h1>${escapeHtml(restaurant.name)}</h1>

<div class="rating">
РўЁ ${Number(restaurant.rating || 0).toFixed(1)}
┬и ${Number(restaurant.review_count || 0)} reviews
</div>

<p>${escapeHtml(restaurant.description || "")}</p>

<div class="tags">
${tags}
${restaurant.price_range ? `<span class="tag">${escapeHtml(restaurant.price_range)}</span>` : ""}
</div>

<p>
<strong>Location:</strong>
${escapeHtml(restaurant.city_name || "")}
${restaurant.area ? " ┬и " + escapeHtml(restaurant.area) : ""}
${restaurant.address ? " ┬и " + escapeHtml(restaurant.address) : ""}
</p>

${
  restaurant.phone
    ? `<p><strong>Phone:</strong> ${escapeHtml(restaurant.phone)}</p>`
    : ""
}

${
  restaurant.website
    ? `<p><a class="btn" href="${escapeHtml(restaurant.website)}" target="_blank" rel="noopener">Visit Website</a></p>`
    : ""
}

</div>

${photoBlock}

<div style="margin-top:35px">
<h2>Reviews</h2>
${reviewBlock}
</div>

<div style="margin-top:35px">
<h2>Write a Review</h2>

<form class="standard" id="reviewForm">

<label>Your Name</label>
<input name="author_name" required>

<label>Email</label>
<input name="author_email" type="email">

<label>Review Title</label>
<input name="title">

<label>Overall Rating</label>
<select name="overall_rating" required>
<option value="">Select rating</option>
<option value="5">5 - Excellent</option>
<option value="4">4 - Very Good</option>
<option value="3">3 - Good</option>
<option value="2">2 - Fair</option>
<option value="1">1 - Poor</option>
</select>

<label>Your Review</label>
<textarea name="body" required></textarea>

<button type="submit">Submit Review</button>

<div id="reviewMessage"></div>

</form>
</div>

</div>
</section>
`;

  const script = `
<script>
document.getElementById("reviewForm").addEventListener("submit",async function(e){
e.preventDefault();

var form=e.target;
var data=Object.fromEntries(new FormData(form).entries());
data.overall_rating=Number(data.overall_rating);

var message=document.getElementById("reviewMessage");

try{
var response=await fetch("/api/restaurants/${encodeURIComponent(
    restaurant.slug
  )}/reviews",{
method:"POST",
headers:{"content-type":"application/json"},
body:JSON.stringify(data)
});

var result=await response.json();

if(!response.ok){
throw new Error(result.error || "Unable to submit review");
}

message.className="notice";
message.textContent=result.message;
form.reset();

}catch(error){
message.className="notice";
message.textContent=error.message;
}
});
</script>
`;

  return pageShell(
    restaurant.name,
    content,
    script
  );
}


// ================================================================
// RECIPE PAGE
// ================================================================

function recipePage(recipe, ingredients, steps) {
  const ingredientHtml = ingredients.length
    ? `<ul>${ingredients
        .map(
          (i) =>
            `<li><strong>${escapeHtml(i.quantity || "")}</strong> ${escapeHtml(i.ingredient)}</li>`
        )
        .join("")}</ul>`
    : `<div class="empty">Ingredients have not been added yet.</div>`;

  const stepsHtml = steps.length
    ? `<ol>${steps
        .map(
          (s) =>
            `<li style="margin-bottom:12px">${escapeHtml(s.instruction)}</li>`
        )
        .join("")}</ol>`
    : `<div class="empty">Recipe steps have not been added yet.</div>`;

  const content = `
<section class="detail">
<div class="container">

<div class="detailHero">

<div class="tag">
${escapeHtml(recipe.category || "Recipe")}
</div>

<h1>${escapeHtml(recipe.title)}</h1>

<p>${escapeHtml(recipe.description || "")}</p>

<div class="tags">
<span class="tag">${escapeHtml(recipe.cuisine || "Home Cooking")}</span>
<span class="tag">${escapeHtml(recipe.difficulty || "Easy")}</span>
<span class="tag">${recipe.prep_minutes || 0} min prep</span>
<span class="tag">${recipe.cook_minutes || 0} min cook</span>
<span class="tag">${recipe.servings || 1} servings</span>
</div>

<div class="rating">
РўЁ ${Number(recipe.rating || 0).toFixed(1)}
</div>

</div>

<div class="two" style="margin-top:25px">

<div class="card">
<div class="cardBody">
<h2>Ingredients</h2>
${ingredientHtml}
</div>
</div>

<div class="card">
<div class="cardBody">
<h2>Method</h2>
${stepsHtml}
</div>
</div>

</div>

</div>
</section>
`;

  return pageShell(recipe.title, content);
}


// ================================================================
// STORY PAGE
// ================================================================

function storyPage(story) {
  const content = `
<section class="detail">
<div class="container">

<article class="detailHero">

<div class="tag">
${escapeHtml(story.category || "Food Story")}
</div>

<h1>${escapeHtml(story.title)}</h1>

<p class="meta">
By ${escapeHtml(story.author_name || "Tastify")}
</p>

${
  story.excerpt
    ? `<p><strong>${escapeHtml(story.excerpt)}</strong></p>`
    : ""
}

<div style="margin-top:30px;white-space:pre-wrap">
${escapeHtml(story.content)}
</div>

</article>

</div>
</section>
`;

  return pageShell(story.title, content);
}


// ================================================================
// NOT FOUND
// ================================================================

function notFoundPage(message) {
  return pageShell(
    "Not Found",
    `
<section class="section">
<div class="container">
<div class="empty">
<h1>${escapeHtml(message)}</h1>
<a class="btn" href="/">Return Home</a>
</div>
</div>
</section>
`
  );
}


// ================================================================
// ADMIN LOGIN PAGE
// ================================================================

function adminLoginPage() {
  return pageShell(
    "Admin Login",
    `
<section class="section">
<div class="container" style="max-width:500px">

<form class="standard" id="loginForm">

<h1 style="font-family:Georgia,serif">
Tastify Admin
</h1>

<p>
Sign in to manage restaurants, recipes, food stories and reviews.
</p>

<label>Admin Password</label>
<input
type="password"
name="password"
required
autocomplete="current-password"
>

<button type="submit">Sign In</button>

<div id="loginMessage"></div>

</form>

</div>
</section>
`,
    `
<script>
document.getElementById("loginForm").addEventListener("submit",async function(e){
e.preventDefault();

var password=e.target.password.value;
var message=document.getElementById("loginMessage");

try{
var response=await fetch("/admin/login",{
method:"POST",
headers:{"content-type":"application/json"},
body:JSON.stringify({password:password})
});

var result=await response.json();

if(!response.ok){
throw new Error(result.error || "Login failed");
}

location.href="/admin";

}catch(error){
message.className="notice";
message.textContent=error.message;
}
});
</script>
`
  );
}


// ================================================================
// ADMIN DASHBOARD
// ================================================================

function adminDashboard() {
  const content = `
<div class="adminWrap">

<div class="adminHeader">
<div class="container nav">
<div>
<strong style="font-family:Georgia,serif;font-size:25px">
Tastify Admin
</strong>
</div>

<div>
<a href="/" style="color:white;margin-right:15px">View Site</a>
<button id="logoutBtn">Logout</button>
</div>
</div>
</div>

<div class="adminLayout">

<aside class="adminSide">

<button onclick="showPanel('dashboard')">Dashboard</button>
<button onclick="showPanel('restaurants')">Restaurants</button>
<button onclick="showPanel('restaurantForm')">Add Restaurant</button>
<button onclick="showPanel('recipes')">Recipes</button>
<button onclick="showPanel('recipeForm')">Add Recipe</button>
<button onclick="showPanel('stories')">Food Stories</button>
<button onclick="showPanel('storyForm')">Add Story</button>
<button onclick="showPanel('reviews')">Reviews</button>
<button onclick="showPanel('cities')">Cities</button>

</aside>

<main class="adminMain">

<div id="dashboard" class="adminPanel">
<h1>Dashboard</h1>

<div class="statGrid">

<div class="stat">
<span>Restaurants</span>
<strong id="statRestaurants">0</strong>
</div>

<div class="stat">
<span>Recipes</span>
<strong id="statRecipes">0</strong>
</div>

<div class="stat">
<span>Stories</span>
<strong id="statStories">0</strong>
</div>

<div class="stat">
<span>Pending Reviews</span>
<strong id="statReviews">0</strong>
</div>

<div class="stat">
<span>Cities</span>
<strong id="statCities">0</strong>
</div>

</div>

<div class="notice">
Use the menu on the left to add and manage Tastify content.
</div>
</div>


<div id="restaurants" class="adminPanel" style="display:none">
<h2>Restaurants</h2>
<div id="restaurantList"></div>
</div>


<div id="restaurantForm" class="adminPanel" style="display:none">

<h2 id="restaurantFormTitle">Add Restaurant</h2>

<form id="restaurantEditor">

<input type="hidden" name="id">

<label>Name</label>
<input name="name" required>

<label>Slug</label>
<input name="slug" placeholder="Leave blank to generate automatically">

<label>Description</label>
<textarea name="description"></textarea>

<div class="two">

<div>
<label>City</label>
<select name="city_id" id="restaurantCity"></select>
</div>

<div>
<label>Area</label>
<input name="area">
</div>

</div>

<label>Address</label>
<input name="address">

<div class="two">

<div>
<label>Phone</label>
<input name="phone">
</div>

<div>
<label>Website</label>
<input name="website" placeholder="https://example.com">
</div>

</div>

<div class="two">

<div>
<label>Cuisine</label>
<input name="cuisine" placeholder="Italian, Burgers, Asian">
</div>

<div>
<label>Price Range</label>
<input name="price_range" placeholder="$, $$, $$$">
</div>

</div>

<div class="two">

<div>
<label>Rating</label>
<input name="rating" type="number" min="0" max="5" step="0.1" value="0">
</div>

<div>
<label>Review Count</label>
<input name="review_count" type="number" min="0" value="0">
</div>

</div>

<label>Categories</label>
<input name="categories" placeholder="Pizza, Pasta, Italian">

<label>
<input name="featured" type="checkbox" style="width:auto">
 Featured
</label>

<label>Status</label>
<select name="status">
<option value="published">Published</option>
<option value="draft">Draft</option>
</select>

<br>

<button type="submit">Save Restaurant</button>
<button type="button" class="gold" onclick="resetRestaurantForm()">Clear</button>

<div id="restaurantMessage"></div>

</form>
</div>


<div id="recipes" class="adminPanel" style="display:none">
<h2>Recipes</h2>
<div id="recipeList"></div>
</div>


<div id="recipeForm" class="adminPanel" style="display:none">

<h2>Recipe Editor</h2>

<form id="recipeEditor">

<input type="hidden" name="id">

<label>Title</label>
<input name="title" required>

<label>Slug</label>
<input name="slug" placeholder="Leave blank to generate automatically">

<label>Description</label>
<textarea name="description"></textarea>

<div class="two">

<div>
<label>Category</label>
<input name="category" placeholder="Breakfast, Dinner, Dessert">
</div>

<div>
<label>Cuisine</label>
<input name="cuisine" placeholder="Italian, Pakistani, Mexican">
</div>

</div>

<div class="two">

<div>
<label>Prep Minutes</label>
<input name="prep_minutes" type="number" min="0" value="0">
</div>

<div>
<label>Cook Minutes</label>
<input name="cook_minutes" type="number" min="0" value="0">
</div>

</div>

<div class="two">

<div>
<label>Servings</label>
<input name="servings" type="number" min="1" value="1">
</div>

<div>
<label>Difficulty</label>
<select name="difficulty">
<option>Easy</option>
<option>Medium</option>
<option>Hard</option>
</select>
</div>

</div>

<label>Rating</label>
<input name="rating" type="number" min="0" max="5" step="0.1" value="0">

<label>Ingredients</label>

<div id="ingredientRows"></div>

<button type="button" onclick="addIngredientRow()">
+ Add Ingredient
</button>

<label>Steps</label>

<div id="stepRows"></div>

<button type="button" onclick="addStepRow()">
+ Add Step
</button>

<br><br>

<label>
<input name="featured" type="checkbox" style="width:auto">
 Featured
</label>

<label>Status</label>
<select name="status">
<option value="published">Published</option>
<option value="draft">Draft</option>
</select>

<br>

<button type="submit">Save Recipe</button>
<button type="button" class="gold" onclick="resetRecipeForm()">Clear</button>

<div id="recipeMessage"></div>

</form>
</div>


<div id="stories" class="adminPanel" style="display:none">
<h2>Food Stories</h2>
<div id="storyList"></div>
</div>


<div id="storyForm" class="adminPanel" style="display:none">

<h2>Story Editor</h2>

<form id="storyEditor">

<input type="hidden" name="id">

<label>Title</label>
<input name="title" required>

<label>Slug</label>
<input name="slug" placeholder="Leave blank to generate automatically">

<label>Excerpt</label>
<textarea name="excerpt"></textarea>

<label>Content</label>
<textarea name="content" style="min-height:300px" required></textarea>

<div class="two">

<div>
<label>Author</label>
<input name="author_name" value="Tastify">
</div>

<div>
<label>Category</label>
<input name="category" placeholder="Food Culture">
</div>

</div>

<label>
<input name="featured" type="checkbox" style="width:auto">
 Featured
</label>

<label>Status</label>
<select name="status">
<option value="published">Published</option>
<option value="draft">Draft</option>
</select>

<br>

<button type="submit">Save Story</button>
<button type="button" class="gold" onclick="resetStoryForm()">Clear</button>

<div id="storyMessage"></div>

</form>
</div>


<div id="reviews" class="adminPanel" style="display:none">

<h2>Review Moderation</h2>

<select id="reviewStatus" onchange="loadReviews()">
<option value="pending">Pending</option>
<option value="approved">Approved</option>
<option value="rejected">Rejected</option>
<option value="all">All</option>
</select>

<div id="reviewList"></div>

</div>


<div id="cities" class="adminPanel" style="display:none">

<h2>Cities</h2>

<form id="cityEditor">

<div class="two">

<div>
<label>City Name</label>
<input name="name" required>
</div>

<div>
<label>Country</label>
<input name="country" value="Pakistan">
</div>

</div>

<br>

<button type="submit">Add City</button>

</form>

<div id="cityList"></div>

</div>

</main>
</div>
</div>
`;

  const script = `
<script>

var restaurants=[];
var recipes=[];
var stories=[];
var cities=[];

function showPanel(id){

var panels=[
"dashboard",
"restaurants",
"restaurantForm",
"recipes",
"recipeForm",
"stories",
"storyForm",
"reviews",
"cities"
];

panels.forEach(function(x){
var el=document.getElementById(x);
if(el) el.style.display=x===id?"block":"none";
});

if(id==="dashboard") loadStats();
if(id==="restaurants") loadRestaurants();
if(id==="recipes") loadRecipes();
if(id==="stories") loadStories();
if(id==="reviews") loadReviews();
if(id==="cities") loadCities();

}

async function api(url,options){

var response=await fetch(url,options||{});

var text=await response.text();

var data;

try{
data=JSON.parse(text);
}catch(error){
throw new Error(
"Server returned HTML instead of JSON. Check the Worker API route."
);
}

if(!response.ok){
throw new Error(data.error||"Request failed");
}

return data;

}


// ------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------

document.getElementById("logoutBtn").addEventListener("click",async function(){

await fetch("/admin/logout",{method:"POST"});

location.href="/admin";

});


// ------------------------------------------------------------
// STATS
// ------------------------------------------------------------

async function loadStats(){

try{

var data=await api("/api/admin/stats");

document.getElementById("statRestaurants").textContent=data.restaurants;
document.getElementById("statRecipes").textContent=data.recipes;
document.getElementById("statStories").textContent=data.stories;
document.getElementById("statReviews").textContent=data.pending_reviews;
document.getElementById("statCities").textContent=data.cities;

}catch(error){
console.error(error);
}

}


// ------------------------------------------------------------
// CITIES
// ------------------------------------------------------------

async function loadCities(){

try{

var data=await api("/api/admin/cities");

cities=data.cities||[];

var select=document.getElementById("restaurantCity");

select.innerHTML='<option value="">Select city</option>';

cities.forEach(function(city){

select.innerHTML+=
'<option value="'+city.id+'">'+escapeClient(city.name)+'</option>';

});

var list=document.getElementById("cityList");

if(!cities.length){
list.innerHTML='<div class="empty">No cities yet.</div>';
return;
}

list.innerHTML=
'<table class="adminTable">'+
'<tr><th>City</th><th>Country</th></tr>'+
cities.map(function(city){
return '<tr>'+
'<td>'+escapeClient(city.name)+'</td>'+
'<td>'+escapeClient(city.country)+'</td>'+
'</tr>';
}).join("")+
'</table>';

}catch(error){

document.getElementById("cityList").innerHTML=
'<div class="notice">'+escapeClient(error.message)+'</div>';

}

}

document.getElementById("cityEditor").addEventListener("submit",async function(e){

e.preventDefault();

var data=Object.fromEntries(new FormData(e.target).entries());

try{

await api("/api/admin/cities",{
method:"POST",
headers:{"content-type":"application/json"},
body:JSON.stringify(data)
});

e.target.reset();
await loadCities();
await loadStats();

alert("City added successfully.");

}catch(error){
alert(error.message);
}

});


// ------------------------------------------------------------
// RESTAURANTS
// ------------------------------------------------------------

async function loadRestaurants(){

var box=document.getElementById("restaurantList");

try{

var data=await api("/api/admin/restaurants");

restaurants=data.restaurants||[];

if(!restaurants.length){
box.innerHTML='<div class="empty">No restaurants yet. Use Add Restaurant.</div>';
return;
}

box.innerHTML=
'<table class="adminTable">'+
'<tr>'+
'<th>Name</th>'+
'<th>City</th>'+
'<th>Rating</th>'+
'<th>Status</th>'+
'<th>Actions</th>'+
'</tr>'+
restaurants.map(function(r){

return '<tr>'+
'<td><strong>'+escapeClient(r.name)+'</strong><br><span class="meta">'+escapeClient(r.cuisine||"")+'</span></td>'+
'<td>'+escapeClient(r.city_name||"")+'</td>'+
'<td>РўЁ '+Number(r.rating||0).toFixed(1)+'<br>'+Number(r.review_count||0)+' reviews</td>'+
'<td>'+escapeClient(r.status)+'</td>'+
'<td>'+
'<button class="smallBtn" onclick="editRestaurant('+r.id+')">Edit</button>'+
'<button class="smallBtn danger" onclick="deleteRestaurant('+r.id+')">Delete</button>'+
'</td>'+
'</tr>';

}).join("")+
'</table>';

}catch(error){

box.innerHTML=
'<div class="notice">'+escapeClient(error.message)+'</div>';

}

}

function resetRestaurantForm(){

var form=document.getElementById("restaurantEditor");

form.reset();

form.elements.id.value="";

document.getElementById("restaurantFormTitle").textContent="Add Restaurant";

}

function editRestaurant(id){

var r=restaurants.find(function(x){
return Number(x.id)===Number(id);
});

if(!r) return;

var form=document.getElementById("restaurantEditor");

form.elements.id.value=r.id;
form.elements.name.value=r.name||"";
form.elements.slug.value=r.slug||"";
form.elements.description.value=r.description||"";
form.elements.city_id.value=r.city_id||"";
form.elements.area.value=r.area||"";
form.elements.address.value=r.address||"";
form.elements.phone.value=r.phone||"";
form.elements.website.value=r.website||"";
form.elements.cuisine.value=r.cuisine||"";
form.elements.price_range.value=r.price_range||"";
form.elements.rating.value=r.rating||0;
form.elements.review_count.value=r.review_count||0;
form.elements.featured.checked=Boolean(r.featured);
form.elements.status.value=r.status||"published";

document.getElementById("restaurantFormTitle").textContent="Edit Restaurant";

showPanel("restaurantForm");

}

document.getElementById("restaurantEditor").addEventListener("submit",async function(e){

e.preventDefault();

var form=e.target;
var data=Object.fromEntries(new FormData(form).entries());

data.city_id=data.city_id||null;
data.rating=Number(data.rating||0);
data.review_count=Number(data.review_count||0);
data.featured=form.elements.featured.checked;
data.categories=String(data.categories||"")
.split(",")
.map(function(x){return x.trim();})
.filter(Boolean);

var id=data.id;

delete data.id;

try{

await api(
id
?"/api/admin/restaurants/"+id
:"/api/admin/restaurants",
{
method:id?"PUT":"POST",
headers:{"content-type":"application/json"},
body:JSON.stringify(data)
}
);

document.getElementById("restaurantMessage").className="notice";
document.getElementById("restaurantMessage").textContent="Restaurant saved successfully.";

resetRestaurantForm();
await loadRestaurants();
await loadStats();

}catch(error){

document.getElementById("restaurantMessage").className="notice";
document.getElementById("restaurantMessage").textContent=error.message;

}

});

async function deleteRestaurant(id){

if(!confirm("Delete this restaurant? This will also remove its reviews and categories.")) return;

try{

await api("/api/admin/restaurants/"+id,{
method:"DELETE"
});

await loadRestaurants();
await loadStats();

}catch(error){
alert(error.message);
}

}


// ------------------------------------------------------------
// RECIPES
// ------------------------------------------------------------

async function loadRecipes(){

var box=document.getElementById("recipeList");

try{

var data=await api("/api/admin/recipes");

recipes=data.recipes||[];

if(!recipes.length){
box.innerHTML='<div class="empty">No recipes yet. Use Add Recipe.</div>';
return;
}

box.innerHTML=
'<table class="adminTable">'+
'<tr>'+
'<th>Recipe</th>'+
'<th>Cuisine</th>'+
'<th>Difficulty</th>'+
'<th>Actions</th>'+
'</tr>'+
recipes.map(function(r){

return '<tr>'+
'<td><strong>'+escapeClient(r.title)+'</strong><br>'+escapeClient(r.category||"")+'</td>'+
'<td>'+escapeClient(r.cuisine||"")+'</td>'+
'<td>'+escapeClient(r.difficulty||"")+'</td>'+
'<td>'+
'<button class="smallBtn" onclick="editRecipe('+r.id+')">Edit</button>'+
'<button class="smallBtn danger" onclick="deleteRecipe('+r.id+')">Delete</button>'+
'</td>'+
'</tr>';

}).join("")+
'</table>';

}catch(error){

box.innerHTML='<div class="notice">'+escapeClient(error.message)+'</div>';

}

}

function addIngredientRow(value,quantity){

var row=document.createElement("div");

row.className="two";

row.style.marginBottom="8px";

row.innerHTML=
'<input class="ingredientName" placeholder="Ingredient" value="'+escapeAttr(value||"")+'">'+
'<div style="display:flex;gap:5px">'+
'<input class="ingredientQuantity" placeholder="Quantity" value="'+escapeAttr(quantity||"")+'">'+
'<button type="button" onclick="this.parentElement.parentElement.remove()">├Ќ</button>'+
'</div>';

document.getElementById("ingredientRows").appendChild(row);

}

function addStepRow(value){

var row=document.createElement("div");

row.style.display="flex";
row.style.gap="6px";
row.style.marginBottom="8px";

row.innerHTML=
'<textarea class="stepInstruction" placeholder="Step instruction">'+
escapeClient(value||"")+
'</textarea>'+
'<button type="button" onclick="this.parentElement.remove()">├Ќ</button>';

document.getElementById("stepRows").appendChild(row);

}

function resetRecipeForm(){

var form=document.getElementById("recipeEditor");

form.reset();

form.elements.id.value="";

document.getElementById("ingredientRows").innerHTML="";
document.getElementById("stepRows").innerHTML="";

addIngredientRow();
addStepRow();

}

async function editRecipe(id){

var r=recipes.find(function(x){
return Number(x.id)===Number(id);
});

if(!r) return;

var form=document.getElementById("recipeEditor");

form.elements.id.value=r.id;
form.elements.title.value=r.title||"";
form.elements.slug.value=r.slug||"";
form.elements.description.value=r.description||"";
form.elements.category.value=r.category||"";
form.elements.cuisine.value=r.cuisine||"";
form.elements.prep_minutes.value=r.prep_minutes||0;
form.elements.cook_minutes.value=r.cook_minutes||0;
form.elements.servings.value=r.servings||1;
form.elements.difficulty.value=r.difficulty||"Easy";
form.elements.rating.value=r.rating||0;
form.elements.featured.checked=Boolean(r.featured);
form.elements.status.value=r.status||"published";

try{

var response=await api("/recipe/"+encodeURIComponent(r.slug));

var doc=new DOMParser().parseFromString(response.html||"","text/html");

}catch(error){}

document.getElementById("ingredientRows").innerHTML="";
document.getElementById("stepRows").innerHTML="";

addIngredientRow();
addStepRow();

showPanel("recipeForm");

}

document.getElementById("recipeEditor").addEventListener("submit",async function(e){

e.preventDefault();

var form=e.target;

var data=Object.fromEntries(new FormData(form).entries());

data.prep_minutes=Number(data.prep_minutes||0);
data.cook_minutes=Number(data.cook_minutes||0);
data.servings=Number(data.servings||1);
data.rating=Number(data.rating||0);
data.featured=form.elements.featured.checked;

data.ingredients=[];

document.querySelectorAll("#ingredientRows > div").forEach(function(row){

var ingredient=row.querySelector(".ingredientName");
var quantity=row.querySelector(".ingredientQuantity");

if(ingredient && ingredient.value.trim()){

data.ingredients.push({
ingredient:ingredient.value.trim(),
quantity:quantity?quantity.value.trim():""
});

}

});

data.steps=[];

document.querySelectorAll(".stepInstruction").forEach(function(el){

if(el.value.trim()){
data.steps.push({
instruction:el.value.trim()
});
}

});

var id=data.id;

delete data.id;

try{

await api(
id
?"/api/admin/recipes/"+id
:"/api/admin/recipes",
{
method:id?"PUT":"POST",
headers:{"content-type":"application/json"},
body:JSON.stringify(data)
}
);

document.getElementById("recipeMessage").className="notice";
document.getElementById("recipeMessage").textContent="Recipe saved successfully.";

resetRecipeForm();

await loadRecipes();
await loadStats();

}catch(error){

document.getElementById("recipeMessage").className="notice";
document.getElementById("recipeMessage").textContent=error.message;

}

});

async function deleteRecipe(id){

if(!confirm("Delete this recipe?")) return;

try{

await api("/api/admin/recipes/"+id,{
method:"DELETE"
});

await loadRecipes();
await loadStats();

}catch(error){
alert(error.message);
}

}


// ------------------------------------------------------------
// STORIES
// ------------------------------------------------------------

async function loadStories(){

var box=document.getElementById("storyList");

try{

var data=await api("/api/admin/stories");

stories=data.stories||[];

if(!stories.length){
box.innerHTML='<div class="empty">No stories yet. Use Add Story.</div>';
return;
}

box.innerHTML=
'<table class="adminTable">'+
'<tr>'+
'<th>Title</th>'+
'<th>Category</th>'+
'<th>Status</th>'+
'<th>Actions</th>'+
'</tr>'+
stories.map(function(s){

return '<tr>'+
'<td><strong>'+escapeClient(s.title)+'</strong></td>'+
'<td>'+escapeClient(s.category||"")+'</td>'+
'<td>'+escapeClient(s.status)+'</td>'+
'<td>'+
'<button class="smallBtn" onclick="editStory('+s.id+')">Edit</button>'+
'<button class="smallBtn danger" onclick="deleteStory('+s.id+')">Delete</button>'+
'</td>'+
'</tr>';

}).join("")+
'</table>';

}catch(error){

box.innerHTML='<div class="notice">'+escapeClient(error.message)+'</div>';

}

}

function resetStoryForm(){

var form=document.getElementById("storyEditor");

form.reset();

form.elements.id.value="";

form.elements.author_name.value="Tastify";

}

function editStory(id){

var s=stories.find(function(x){
return Number(x.id)===Number(id);
});

if(!s) return;

var form=document.getElementById("storyEditor");

form.elements.id.value=s.id;
form.elements.title.value=s.title||"";
form.elements.slug.value=s.slug||"";
form.elements.excerpt.value=s.excerpt||"";
form.elements.content.value=s.content||"";
form.elements.author_name.value=s.author_name||"Tastify";
form.elements.category.value=s.category||"";
form.elements.featured.checked=Boolean(s.featured);
form.elements.status.value=s.status||"published";

showPanel("storyForm");

}

document.getElementById("storyEditor").addEventListener("submit",async function(e){

e.preventDefault();

var form=e.target;

var data=Object.fromEntries(new FormData(form).entries());

data.featured=form.elements.featured.checked;

var id=data.id;

delete data.id;

try{

await api(
id
?"/api/admin/stories/"+id
:"/api/admin/stories",
{
method:id?"PUT":"POST",
headers:{"content-type":"application/json"},
body:JSON.stringify(data)
}
);

document.getElementById("storyMessage").className="notice";
document.getElementById("storyMessage").textContent="Story saved successfully.";

resetStoryForm();

await loadStories();
await loadStats();

}catch(error){

document.getElementById("storyMessage").className="notice";
document.getElementById("storyMessage").textContent=error.message;

}

});

async function deleteStory(id){

if(!confirm("Delete this story?")) return;

try{

await api("/api/admin/stories/"+id,{
method:"DELETE"
});

await loadStories();
await loadStats();

}catch(error){
alert(error.message);
}

}


// ------------------------------------------------------------
// REVIEWS
// ------------------------------------------------------------

async function loadReviews(){

var box=document.getElementById("reviewList");

var status=document.getElementById("reviewStatus").value;

try{

var data=await api(
"/api/admin/reviews?status="+encodeURIComponent(status)
);

var reviews=data.reviews||[];

if(!reviews.length){

box.innerHTML='<div class="empty">No reviews found.</div>';

return;

}

box.innerHTML=reviews.map(function(r){

var buttons="";

if(r.status!=="approved"){

buttons+='<button class="smallBtn success" onclick="approveReview('+r.id+')">Approve</button>';

}

if(r.status!=="rejected"){

buttons+='<button class="smallBtn danger" onclick="rejectReview('+r.id+')">Reject</button>';

}

return '<div class="review">'+
'<strong>'+escapeClient(r.author_name)+'</strong>'+
'<div class="rating">РўЁ '+escapeClient(r.overall_rating)+'/5</div>'+
'<div class="meta">'+escapeClient(r.restaurant_name)+' ┬и '+escapeClient(r.status)+'</div>'+
(r.title?'<h3>'+escapeClient(r.title)+'</h3>':"")+
'<p>'+escapeClient(r.body)+'</p>'+
buttons+
'</div>';

}).join("");

}catch(error){

box.innerHTML='<div class="notice">'+escapeClient(error.message)+'</div>';

}

}

async function approveReview(id){

try{

await api("/api/admin/reviews/"+id+"/approve",{
method:"POST"
});

await loadReviews();
await loadStats();

}catch(error){
alert(error.message);
}

}

async function rejectReview(id){

if(!confirm("Reject this review?")) return;

try{

await api("/api/admin/reviews/"+id+"/reject",{
method:"POST"
});

await loadReviews();
await loadStats();

}catch(error){
alert(error.message);
}

}


// ------------------------------------------------------------
// CLIENT ESCAPING
// ------------------------------------------------------------

function escapeClient(value){

return String(value==null?"":value)
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;");

}

function escapeAttr(value){

return escapeClient(value);

}


// ------------------------------------------------------------
// START DASHBOARD
// ------------------------------------------------------------

resetRecipeForm();
loadStats();

</script>
`;

  return pageShell(
    "Admin Dashboard",
    content,
    script
  );
}
