// Tastify — Complete Cloudflare Worker
// Public website + D1 API + secure admin dashboard
// No additional npm packages required.

const APP_NAME = "Tastify";
const SESSION_COOKIE = "tastify_admin";
const SESSION_TTL = 12 * 60 * 60; // 12 hours

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method.toUpperCase();

      // -----------------------------
      // PUBLIC API
      // -----------------------------

      if (path === "/api/cities" && method === "GET") {
        return await getCities(env);
      }

      if (path === "/api/restaurants" && method === "GET") {
        return await getRestaurants(env, url);
      }

      if (path === "/api/recipes" && method === "GET") {
        return await getRecipes(env, url);
      }

      if (path === "/api/stories" && method === "GET") {
        return await getStories(env, url);
      }

      // -----------------------------
      // PUBLIC REVIEW SUBMISSION
      // -----------------------------

      if (
        path.startsWith("/api/restaurants/") &&
        path.endsWith("/reviews") &&
        method === "POST"
      ) {
        const parts = path.split("/").filter(Boolean);
        const slug = parts[2];

        if (!slug) {
          return json({ error: "Restaurant not found." }, 404);
        }

        return await submitReview(request, env, slug);
      }

      // -----------------------------
      // ADMIN LOGIN / LOGOUT
      // -----------------------------

      if (path === "/admin/login" && method === "GET") {
        return html(adminLoginPage());
      }

      if (path === "/admin/login" && method === "POST") {
        return await adminLogin(request, env);
      }

      if (path === "/admin/logout" && method === "POST") {
        return await adminLogout(request);
      }

      // -----------------------------
      // ADMIN DASHBOARD
      // -----------------------------

      if (path === "/admin" && method === "GET") {
        if (!(await isAdmin(request, env))) {
          return Response.redirect(
            new URL("/admin/login", request.url).toString(),
            302
          );
        }

        return html(await adminDashboard(env));
      }

      // -----------------------------
      // ADMIN STATS
      // -----------------------------

      if (path === "/api/admin/stats" && method === "GET") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        return await adminStats(env);
      }

      // -----------------------------
      // ADMIN REVIEWS
      // -----------------------------

      if (path === "/api/admin/reviews" && method === "GET") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        return await adminReviews(env, url);
      }

      const reviewActionMatch = path.match(
        /^\/api\/admin\/reviews\/(\d+)\/(approve|reject)$/
      );

      if (reviewActionMatch && method === "POST") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        if (!sameOrigin(request)) {
          return json({ error: "Invalid request origin." }, 403);
        }

        const reviewId = Number(reviewActionMatch[1]);
        const action = reviewActionMatch[2];

        return await changeReviewStatus(env, reviewId, action);
      }

      // -----------------------------
      // ADMIN RESTAURANTS
      // -----------------------------

      if (path === "/api/admin/restaurants" && method === "GET") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        return await adminRestaurants(env);
      }

      if (path === "/api/admin/restaurants" && method === "POST") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        if (!sameOrigin(request)) {
          return json({ error: "Invalid request origin." }, 403);
        }

        return await createRestaurant(request, env);
      }

      const adminRestaurantMatch = path.match(
        /^\/api\/admin\/restaurants\/(\d+)$/
      );

      if (adminRestaurantMatch && method === "PUT") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        if (!sameOrigin(request)) {
          return json({ error: "Invalid request origin." }, 403);
        }

        return await updateRestaurant(
          request,
          env,
          Number(adminRestaurantMatch[1])
        );
      }

      if (adminRestaurantMatch && method === "DELETE") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        if (!sameOrigin(request)) {
          return json({ error: "Invalid request origin." }, 403);
        }

        return await deleteRestaurant(
          env,
          Number(adminRestaurantMatch[1])
        );
      }

      // -----------------------------
      // ADMIN CITIES
      // -----------------------------

      if (path === "/api/admin/cities" && method === "GET") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        return await adminCities(env);
      }

      if (path === "/api/admin/cities" && method === "POST") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        if (!sameOrigin(request)) {
          return json({ error: "Invalid request origin." }, 403);
        }

        return await createCity(request, env);
      }

      // -----------------------------
      // ADMIN RECIPES
      // -----------------------------

      if (path === "/api/admin/recipes" && method === "GET") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        return await adminRecipes(env);
      }

      if (path === "/api/admin/recipes" && method === "POST") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        if (!sameOrigin(request)) {
          return json({ error: "Invalid request origin." }, 403);
        }

        return await createRecipe(request, env);
      }

      const adminRecipeMatch = path.match(
        /^\/api\/admin\/recipes\/(\d+)$/
      );

      if (adminRecipeMatch && method === "DELETE") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        if (!sameOrigin(request)) {
          return json({ error: "Invalid request origin." }, 403);
        }

        return await deleteRecipe(
          env,
          Number(adminRecipeMatch[1])
        );
      }

      // -----------------------------
      // ADMIN STORIES
      // -----------------------------

      if (path === "/api/admin/stories" && method === "GET") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        return await adminStories(env);
      }

      if (path === "/api/admin/stories" && method === "POST") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        if (!sameOrigin(request)) {
          return json({ error: "Invalid request origin." }, 403);
        }

        return await createStory(request, env);
      }

      const adminStoryMatch = path.match(
        /^\/api\/admin\/stories\/(\d+)$/
      );

      if (adminStoryMatch && method === "DELETE") {
        if (!(await isAdmin(request, env))) {
          return json({ error: "Unauthorized." }, 401);
        }

        if (!sameOrigin(request)) {
          return json({ error: "Invalid request origin." }, 403);
        }

        return await deleteStory(
          env,
          Number(adminStoryMatch[1])
        );
      }

      // -----------------------------
      // PUBLIC RESTAURANT PAGE
      // -----------------------------

      if (path.startsWith("/restaurant/") && method === "GET") {
        const slug = path.split("/").filter(Boolean)[1];

        if (!slug) {
          return html(notFoundPage(), 404);
        }

        return await restaurantPage(env, slug);
      }

      // -----------------------------
      // PUBLIC RECIPE PAGE
      // -----------------------------

      if (path.startsWith("/recipe/") && method === "GET") {
        const slug = path.split("/").filter(Boolean)[1];

        if (!slug) {
          return html(notFoundPage(), 404);
        }

        return await recipePage(env, slug);
      }

      // -----------------------------
      // PUBLIC STORY PAGE
      // -----------------------------

      if (path.startsWith("/story/") && method === "GET") {
        const slug = path.split("/").filter(Boolean)[1];

        if (!slug) {
          return html(notFoundPage(), 404);
        }

        return await storyPage(env, slug);
      }

      // -----------------------------
      // HOME PAGE
      // -----------------------------

      if (path === "/" && method === "GET") {
        return await homePage(env, url);
      }

      return html(notFoundPage(), 404);
    } catch (error) {
      console.error("Tastify Worker Error:", error);

      return json(
        {
          error: "Tastify is temporarily unavailable."
        },
        500
      );
    }
  }
};


// ============================================================
// BASIC RESPONSE HELPERS
// ============================================================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}

function html(content, status = 200) {
  return new Response(content, {
    status,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}


// ============================================================
// SECURITY / UTILITIES
// ============================================================

function clean(value, maxLength = 500) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}

function slugify(value) {
  return clean(value, 150)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value) {
  const url = clean(value, 500);

  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

function sameOrigin(request) {
  const origin = request.headers.get("Origin");

  if (!origin) {
    return true;
  }

  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const cookies = {};

  for (const item of header.split(";")) {
    const index = item.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();

    cookies[key] = value;
  }

  return cookies;
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }

  return bytes;
}

function base64Encode(value) {
  return btoa(value);
}

function base64Decode(value) {
  return atob(value);
}

async function hmacSign(value, secret) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
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
    encoder.encode(value)
  );

  return bytesToHex(new Uint8Array(signature));
}

async function createSession(env) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const payload = "admin:" + expires;

  const encoded = base64Encode(payload);
  const signature = await hmacSign(encoded, env.ADMIN_SECRET);

  return encoded + "." + signature;
}

async function verifySession(token, env) {
  if (!token || !env.ADMIN_SECRET) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const encoded = parts[0];
  const suppliedSignature = parts[1];

  const expectedSignature = await hmacSign(
    encoded,
    env.ADMIN_SECRET
  );

  if (
    !constantTimeEqual(
      suppliedSignature,
      expectedSignature
    )
  ) {
    return false;
  }

  try {
    const payload = base64Decode(encoded);
    const parts2 = payload.split(":");

    if (parts2[0] !== "admin") {
      return false;
    }

    const expires = Number(parts2[1]);

    if (!Number.isFinite(expires)) {
      return false;
    }

    return expires > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    return false;
  }

  const cookies = parseCookies(request);

  return await verifySession(
    cookies[SESSION_COOKIE],
    env
  );
}

function sessionCookie(token) {
  return (
    SESSION_COOKIE +
    "=" +
    token +
    "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" +
    SESSION_TTL
  );
}

function clearSessionCookie() {
  return (
    SESSION_COOKIE +
    "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  );
}


// ============================================================
// PUBLIC CITIES
// ============================================================

async function getCities(env) {
  const result = await env.DB.prepare(
    `
    SELECT id, name, country, slug
    FROM cities
    ORDER BY name ASC
    `
  ).all();

  return json({
    cities: result.results || []
  });
}


// ============================================================
// PUBLIC RESTAURANTS
// ============================================================

async function getRestaurants(env, url) {
  const search = clean(url.searchParams.get("search"), 100);
  const city = clean(url.searchParams.get("city"), 100);
  const category = clean(
    url.searchParams.get("category"),
    100
  );

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
      r.status,
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

    const q = "%" + search + "%";

    params.push(q, q, q, q);
  }

  if (city) {
    sql += ` AND c.slug = ? `;
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
    LIMIT 100
  `;

  const result = await env.DB
    .prepare(sql)
    .bind(...params)
    .all();

  return json({
    restaurants: result.results || []
  });
}


// ============================================================
// PUBLIC RECIPES
// ============================================================

async function getRecipes(env, url) {
  const search = clean(url.searchParams.get("search"), 100);
  const category = clean(
    url.searchParams.get("category"),
    100
  );

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
      featured,
      created_at
    FROM recipes
    WHERE status = 'published'
  `;

  const params = [];

  if (search) {
    const q = "%" + search + "%";

    sql += `
      AND (
        title LIKE ?
        OR description LIKE ?
        OR category LIKE ?
        OR cuisine LIKE ?
      )
    `;

    params.push(q, q, q, q);
  }

  if (category) {
    sql += ` AND LOWER(category) = LOWER(?) `;
    params.push(category);
  }

  sql += `
    ORDER BY featured DESC, rating DESC, created_at DESC
    LIMIT 100
  `;

  const result = await env.DB
    .prepare(sql)
    .bind(...params)
    .all();

  return json({
    recipes: result.results || []
  });
}


// ============================================================
// PUBLIC STORIES
// ============================================================

async function getStories(env, url) {
  const category = clean(
    url.searchParams.get("category"),
    100
  );

  let sql = `
    SELECT
      id,
      title,
      slug,
      excerpt,
      content,
      author_name,
      category,
      featured,
      created_at
    FROM food_stories
    WHERE status = 'published'
  `;

  const params = [];

  if (category) {
    sql += ` AND LOWER(category) = LOWER(?) `;
    params.push(category);
  }

  sql += `
    ORDER BY featured DESC, created_at DESC
    LIMIT 100
  `;

  const result = await env.DB
    .prepare(sql)
    .bind(...params)
    .all();

  return json({
    stories: result.results || []
  });
}


// ============================================================
// PUBLIC REVIEW SUBMISSION
// ============================================================

async function submitReview(request, env, slug) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({
      error: "Invalid JSON."
    }, 400);
  }

  const authorName = clean(body.author_name, 100);
  const authorEmail = clean(body.author_email, 150);
  const title = clean(body.title, 150);
  const reviewBody = clean(body.body, 3000);

  const overallRating = Number(body.overall_rating);
  const foodRating = body.food_rating
    ? Number(body.food_rating)
    : null;
  const serviceRating = body.service_rating
    ? Number(body.service_rating)
    : null;
  const atmosphereRating = body.atmosphere_rating
    ? Number(body.atmosphere_rating)
    : null;
  const valueRating = body.value_rating
    ? Number(body.value_rating)
    : null;

  if (!authorName) {
    return json({
      error: "Please enter your name."
    }, 400);
  }

  if (!reviewBody) {
    return json({
      error: "Please write a review."
    }, 400);
  }

  if (
    !Number.isInteger(overallRating) ||
    overallRating < 1 ||
    overallRating > 5
  ) {
    return json({
      error: "Overall rating must be between 1 and 5."
    }, 400);
  }

  const optionalRatings = [
    foodRating,
    serviceRating,
    atmosphereRating,
    valueRating
  ];

  for (const rating of optionalRatings) {
    if (
      rating !== null &&
      (!Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5)
    ) {
      return json({
        error: "Ratings must be between 1 and 5."
      }, 400);
    }
  }

  const restaurant = await env.DB
    .prepare(
      `
      SELECT id, name
      FROM restaurants
      WHERE slug = ?
      AND status = 'published'
      LIMIT 1
      `
    )
    .bind(slug)
    .first();

  if (!restaurant) {
    return json({
      error: "Restaurant not found."
    }, 404);
  }

  await env.DB
    .prepare(
      `
      INSERT INTO reviews (
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `
    )
    .bind(
      restaurant.id,
      authorName,
      authorEmail || null,
      title || null,
      reviewBody,
      overallRating,
      foodRating,
      serviceRating,
      atmosphereRating,
      valueRating
    )
    .run();

  return json({
    success: true,
    message:
      "Thank you. Your review has been submitted for moderation."
  }, 201);
}


// ============================================================
// ADMIN LOGIN
// ============================================================

async function adminLogin(request, env) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    return html(
      errorPage(
        "Admin configuration is incomplete.",
        "Please add ADMIN_PASSWORD and ADMIN_SECRET as Cloudflare Worker secrets."
      ),
      500
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({
      error: "Invalid request."
    }, 400);
  }

  const password = clean(body.password, 300);

  if (!constantTimeEqual(password, env.ADMIN_PASSWORD)) {
    return json({
      error: "Incorrect password."
    }, 401);
  }

  const token = await createSession(env);

  return new Response(
    JSON.stringify({
      success: true
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store",
        "Set-Cookie": sessionCookie(token)
      }
    }
  );
}

async function adminLogout(request) {
  if (!sameOrigin(request)) {
    return json({
      error: "Invalid request origin."
    }, 403);
  }

  return new Response(
    JSON.stringify({
      success: true
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store",
        "Set-Cookie": clearSessionCookie()
      }
    }
  );
}


// ============================================================
// ADMIN STATS
// ============================================================

async function adminStats(env) {
  const [
    restaurants,
    pendingReviews,
    approvedReviews,
    recipes,
    stories,
    cities
  ] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM restaurants`
    ).first(),

    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM reviews WHERE status = 'pending'`
    ).first(),

    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM reviews WHERE status = 'approved'`
    ).first(),

    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM recipes`
    ).first(),

    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM food_stories`
    ).first(),

    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM cities`
    ).first()
  ]);

  return json({
    restaurants: Number(restaurants?.count || 0),
    pending_reviews: Number(pendingReviews?.count || 0),
    approved_reviews: Number(approvedReviews?.count || 0),
    recipes: Number(recipes?.count || 0),
    stories: Number(stories?.count || 0),
    cities: Number(cities?.count || 0)
  });
}


// ============================================================
// ADMIN REVIEWS
// ============================================================

async function adminReviews(env, url) {
  const status = clean(
    url.searchParams.get("status"),
    30
  );

  let sql = `
    SELECT
      rv.id,
      rv.restaurant_id,
      rv.author_name,
      rv.author_email,
      rv.title,
      rv.body,
      rv.overall_rating,
      rv.food_rating,
      rv.service_rating,
      rv.atmosphere_rating,
      rv.value_rating,
      rv.status,
      rv.created_at,
      r.name AS restaurant_name,
      r.slug AS restaurant_slug
    FROM reviews rv
    JOIN restaurants r
      ON r.id = rv.restaurant_id
  `;

  const params = [];

  if (
    status === "pending" ||
    status === "approved" ||
    status === "rejected"
  ) {
    sql += ` WHERE rv.status = ? `;
    params.push(status);
  }

  sql += `
    ORDER BY
      CASE rv.status
        WHEN 'pending' THEN 0
        WHEN 'approved' THEN 1
        ELSE 2
      END,
      rv.created_at DESC
    LIMIT 200
  `;

  const result = await env.DB
    .prepare(sql)
    .bind(...params)
    .all();

  return json({
    reviews: result.results || []
  });
}


// ============================================================
// REVIEW APPROVE / REJECT
// ============================================================

async function changeReviewStatus(env, reviewId, action) {
  if (!Number.isInteger(reviewId) || reviewId < 1) {
    return json({
      error: "Invalid review ID."
    }, 400);
  }

  if (action !== "approve" && action !== "reject") {
    return json({
      error: "Invalid action."
    }, 400);
  }

  const review = await env.DB
    .prepare(
      `
      SELECT
        id,
        restaurant_id,
        overall_rating,
        status
      FROM reviews
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(reviewId)
    .first();

  if (!review) {
    return json({
      error: "Review not found."
    }, 404);
  }

  const restaurant = await env.DB
    .prepare(
      `
      SELECT
        id,
        rating,
        review_count
      FROM restaurants
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(review.restaurant_id)
    .first();

  if (!restaurant) {
    return json({
      error: "Restaurant not found."
    }, 404);
  }

  const beforeApproved = await env.DB
    .prepare(
      `
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(overall_rating), 0) AS sum
      FROM reviews
      WHERE restaurant_id = ?
      AND status = 'approved'
      `
    )
    .bind(review.restaurant_id)
    .first();

  const oldCount = Math.max(
    0,
    Number(restaurant.review_count || 0)
  );

  const oldRating = Number(
    restaurant.rating || 0
  );

  const beforeCount = Number(
    beforeApproved?.count || 0
  );

  const beforeSum = Number(
    beforeApproved?.sum || 0
  );

  // The seeded restaurant aggregate can contain reviews
  // that existed before Tastify's review table.
  // Preserve that historical aggregate while adding/removing
  // newly moderated Tastify reviews.
  let legacyCount = oldCount - beforeCount;

  if (legacyCount < 0) {
    legacyCount = 0;
  }

  let legacySum =
    oldRating * oldCount - beforeSum;

  if (legacySum < 0) {
    legacySum = 0;
  }

  const newStatus =
    action === "approve"
      ? "approved"
      : "rejected";

  if (review.status === newStatus) {
    return json({
      success: true,
      message:
        "Review is already " + newStatus + "."
    });
  }

  await env.DB
    .prepare(
      `
      UPDATE reviews
      SET status = ?
      WHERE id = ?
      `
    )
    .bind(newStatus, reviewId)
    .run();

  const afterApproved = await env.DB
    .prepare(
      `
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(overall_rating), 0) AS sum
      FROM reviews
      WHERE restaurant_id = ?
      AND status = 'approved'
      `
    )
    .bind(review.restaurant_id)
    .first();

  const afterCount = Number(
    afterApproved?.count || 0
  );

  const afterSum = Number(
    afterApproved?.sum || 0
  );

  const finalCount =
    legacyCount + afterCount;

  const finalSum =
    legacySum + afterSum;

  const finalRating =
    finalCount > 0
      ? Number((finalSum / finalCount).toFixed(2))
      : 0;

  await env.DB
    .prepare(
      `
      UPDATE restaurants
      SET
        rating = ?,
        review_count = ?
      WHERE id = ?
      `
    )
    .bind(
      finalRating,
      finalCount,
      review.restaurant_id
    )
    .run();

  return json({
    success: true,
    status: newStatus,
    restaurant_id: review.restaurant_id,
    rating: finalRating,
    review_count: finalCount
  });
}


// ============================================================
// ADMIN RESTAURANTS
// ============================================================

async function adminRestaurants(env) {
  const result = await env.DB
    .prepare(
      `
      SELECT
        r.*,
        c.name AS city_name
      FROM restaurants r
      LEFT JOIN cities c
        ON c.id = r.city_id
      ORDER BY r.created_at DESC
      `
    )
    .all();

  return json({
    restaurants: result.results || []
  });
}

async function createRestaurant(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({
      error: "Invalid JSON."
    }, 400);
  }

  const name = clean(body.name, 150);
  const description = clean(body.description, 2000);
  const cityId = Number(body.city_id) || null;
  const area = clean(body.area, 150);
  const address = clean(body.address, 300);
  const phone = clean(body.phone, 100);
  const website = safeUrl(body.website);
  const cuisine = clean(body.cuisine, 150);
  const priceRange = clean(body.price_range, 20);
  const rating = Number(body.rating || 0);
  const reviewCount = Number(body.review_count || 0);
  const featured = body.featured ? 1 : 0;
  const status =
    body.status === "draft"
      ? "draft"
      : "published";

  if (!name) {
    return json({
      error: "Restaurant name is required."
    }, 400);
  }

  if (
    rating < 0 ||
    rating > 5
  ) {
    return json({
      error: "Rating must be between 0 and 5."
    }, 400);
  }

  if (
    reviewCount < 0 ||
    !Number.isInteger(reviewCount)
  ) {
    return json({
      error: "Invalid review count."
    }, 400);
  }

  let slug = slugify(body.slug || name);

  if (!slug) {
    return json({
      error: "A valid slug is required."
    }, 400);
  }

  slug = await uniqueSlug(
    env,
    "restaurants",
    slug
  );

  await env.DB
    .prepare(
      `
      INSERT INTO restaurants (
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      name,
      slug,
      description || null,
      cityId,
      area || null,
      address || null,
      phone || null,
      website || null,
      cuisine || null,
      priceRange || null,
      rating,
      reviewCount,
      featured,
      status
    )
    .run();

  const restaurant = await env.DB
    .prepare(
      `
      SELECT *
      FROM restaurants
      WHERE slug = ?
      LIMIT 1
      `
    )
    .bind(slug)
    .first();

  return json({
    success: true,
    restaurant
  }, 201);
}

async function updateRestaurant(request, env, id) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({
      error: "Invalid JSON."
    }, 400);
  }

  const existing = await env.DB
    .prepare(
      `
      SELECT *
      FROM restaurants
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(id)
    .first();

  if (!existing) {
    return json({
      error: "Restaurant not found."
    }, 404);
  }

  const name = clean(
    body.name !== undefined
      ? body.name
      : existing.name,
    150
  );

  const description = clean(
    body.description !== undefined
      ? body.description
      : existing.description,
    2000
  );

  const cityId =
    body.city_id !== undefined
      ? Number(body.city_id) || null
      : existing.city_id;

  const area = clean(
    body.area !== undefined
      ? body.area
      : existing.area,
    150
  );

  const address = clean(
    body.address !== undefined
      ? body.address
      : existing.address,
    300
  );

  const phone = clean(
    body.phone !== undefined
      ? body.phone
      : existing.phone,
    100
  );

  const website =
    body.website !== undefined
      ? safeUrl(body.website)
      : existing.website;

  const cuisine = clean(
    body.cuisine !== undefined
      ? body.cuisine
      : existing.cuisine,
    150
  );

  const priceRange = clean(
    body.price_range !== undefined
      ? body.price_range
      : existing.price_range,
    20
  );

  const rating =
    body.rating !== undefined
      ? Number(body.rating)
      : Number(existing.rating || 0);

  const reviewCount =
    body.review_count !== undefined
      ? Number(body.review_count)
      : Number(existing.review_count || 0);

  const featured =
    body.featured !== undefined
      ? (body.featured ? 1 : 0)
      : Number(existing.featured || 0);

  const status =
    body.status === "draft"
      ? "draft"
      : body.status === "published"
        ? "published"
        : existing.status;

  let slug =
    body.slug !== undefined
      ? slugify(body.slug)
      : existing.slug;

  if (!slug) {
    slug = existing.slug;
  }

  if (slug !== existing.slug) {
    slug = await uniqueSlug(
      env,
      "restaurants",
      slug,
      id
    );
  }

  if (!name) {
    return json({
      error: "Restaurant name is required."
    }, 400);
  }

  if (
    rating < 0 ||
    rating > 5 ||
    !Number.isFinite(rating)
  ) {
    return json({
      error: "Rating must be between 0 and 5."
    }, 400);
  }

  if (
    reviewCount < 0 ||
    !Number.isInteger(reviewCount)
  ) {
    return json({
      error: "Invalid review count."
    }, 400);
  }

  await env.DB
    .prepare(
      `
      UPDATE restaurants
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
      WHERE id = ?
      `
    )
    .bind(
      name,
      slug,
      description || null,
      cityId,
      area || null,
      address || null,
      phone || null,
      website || null,
      cuisine || null,
      priceRange || null,
      rating,
      reviewCount,
      featured,
      status,
      id
    )
    .run();

  const restaurant = await env.DB
    .prepare(
      `
      SELECT *
      FROM restaurants
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(id)
    .first();

  return json({
    success: true,
    restaurant
  });
}

async function deleteRestaurant(env, id) {
  const existing = await env.DB
    .prepare(
      `
      SELECT id
      FROM restaurants
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(id)
    .first();

  if (!existing) {
    return json({
      error: "Restaurant not found."
    }, 404);
  }

  await env.DB
    .prepare(
      `
      DELETE FROM restaurants
      WHERE id = ?
      `
    )
    .bind(id)
    .run();

  return json({
    success: true
  });
}


// ============================================================
// ADMIN CITIES
// ============================================================

async function adminCities(env) {
  const result = await env.DB
    .prepare(
      `
      SELECT *
      FROM cities
      ORDER BY name ASC
      `
    )
    .all();

  return json({
    cities: result.results || []
  });
}

async function createCity(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({
      error: "Invalid JSON."
    }, 400);
  }

  const name = clean(body.name, 100);
  const country =
    clean(body.country, 100) || "Pakistan";

  let slug = slugify(body.slug || name);

  if (!name || !slug) {
    return json({
      error: "City name is required."
    }, 400);
  }

  slug = await uniqueSlug(
    env,
    "cities",
    slug
  );

  await env.DB
    .prepare(
      `
      INSERT INTO cities (
        name,
        country,
        slug
      )
      VALUES (?, ?, ?)
      `
    )
    .bind(
      name,
      country,
      slug
    )
    .run();

  const city = await env.DB
    .prepare(
      `
      SELECT *
      FROM cities
      WHERE slug = ?
      LIMIT 1
      `
    )
    .bind(slug)
    .first();

  return json({
    success: true,
    city
  }, 201);
}


// ============================================================
// ADMIN RECIPES
// ============================================================

async function adminRecipes(env) {
  const result = await env.DB
    .prepare(
      `
      SELECT *
      FROM recipes
      ORDER BY created_at DESC
      `
    )
    .all();

  return json({
    recipes: result.results || []
  });
}

async function createRecipe(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({
      error: "Invalid JSON."
    }, 400);
  }

  const title = clean(body.title, 150);
  const description = clean(body.description, 2000);
  const category = clean(body.category, 100);
  const cuisine = clean(body.cuisine, 100);
  const prepMinutes = Number(body.prep_minutes || 0);
  const cookMinutes = Number(body.cook_minutes || 0);
  const servings = Number(body.servings || 1);
  const difficulty =
    ["Easy", "Medium", "Hard"].includes(
      body.difficulty
    )
      ? body.difficulty
      : "Easy";

  const rating = Number(body.rating || 0);
  const featured = body.featured ? 1 : 0;
  const status =
    body.status === "draft"
      ? "draft"
      : "published";

  if (!title) {
    return json({
      error: "Recipe title is required."
    }, 400);
  }

  let slug = slugify(body.slug || title);

  if (!slug) {
    return json({
      error: "A valid slug is required."
    }, 400);
  }

  slug = await uniqueSlug(
    env,
    "recipes",
    slug
  );

  await env.DB
    .prepare(
      `
      INSERT INTO recipes (
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      title,
      slug,
      description || null,
      category || null,
      cuisine || null,
      Math.max(0, prepMinutes),
      Math.max(0, cookMinutes),
      Math.max(1, servings),
      difficulty,
      Math.max(0, Math.min(5, rating)),
      featured,
      status
    )
    .run();

  const recipe = await env.DB
    .prepare(
      `
      SELECT *
      FROM recipes
      WHERE slug = ?
      LIMIT 1
      `
    )
    .bind(slug)
    .first();

  // Optional ingredients
  if (Array.isArray(body.ingredients)) {
    let order = 1;

    for (const item of body.ingredients) {
      if (!item) {
        continue;
      }

      const ingredient =
        typeof item === "string"
          ? clean(item, 300)
          : clean(item.ingredient, 300);

      const quantity =
        typeof item === "string"
          ? ""
          : clean(item.quantity, 100);

      if (!ingredient) {
        continue;
      }

      await env.DB
        .prepare(
          `
          INSERT INTO recipe_ingredients (
            recipe_id,
            ingredient,
            quantity,
            sort_order
          )
          VALUES (?, ?, ?, ?)
          `
        )
        .bind(
          recipe.id,
          ingredient,
          quantity || null,
          order++
        )
        .run();
    }
  }

  // Optional steps
  if (Array.isArray(body.steps)) {
    let stepNumber = 1;

    for (const item of body.steps) {
      const instruction =
        typeof item === "string"
          ? clean(item, 2000)
          : clean(item.instruction, 2000);

      if (!instruction) {
        continue;
      }

      await env.DB
        .prepare(
          `
          INSERT INTO recipe_steps (
            recipe_id,
            step_number,
            instruction
          )
          VALUES (?, ?, ?)
          `
        )
        .bind(
          recipe.id,
          stepNumber++,
          instruction
        )
        .run();
    }
  }

  return json({
    success: true,
    recipe
  }, 201);
}

async function deleteRecipe(env, id) {
  const existing = await env.DB
    .prepare(
      `
      SELECT id
      FROM recipes
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(id)
    .first();

  if (!existing) {
    return json({
      error: "Recipe not found."
    }, 404);
  }

  await env.DB
    .prepare(
      `
      DELETE FROM recipes
      WHERE id = ?
      `
    )
    .bind(id)
    .run();

  return json({
    success: true
  });
}


// ============================================================
// ADMIN STORIES
// ============================================================

async function adminStories(env) {
  const result = await env.DB
    .prepare(
      `
      SELECT *
      FROM food_stories
      ORDER BY created_at DESC
      `
    )
    .all();

  return json({
    stories: result.results || []
  });
}

async function createStory(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({
      error: "Invalid JSON."
    }, 400);
  }

  const title = clean(body.title, 200);
  const excerpt = clean(body.excerpt, 1000);
  const content = clean(body.content, 10000);
  const authorName =
    clean(body.author_name, 100) || "Tastify";
  const category = clean(body.category, 100);
  const featured = body.featured ? 1 : 0;
  const status =
    body.status === "draft"
      ? "draft"
      : "published";

  if (!title || !content) {
    return json({
      error: "Title and content are required."
    }, 400);
  }

  let slug = slugify(body.slug || title);

  if (!slug) {
    return json({
      error: "A valid slug is required."
    }, 400);
  }

  slug = await uniqueSlug(
    env,
    "food_stories",
    slug
  );

  await env.DB
    .prepare(
      `
      INSERT INTO food_stories (
        title,
        slug,
        excerpt,
        content,
        author_name,
        category,
        featured,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      title,
      slug,
      excerpt || null,
      content,
      authorName,
      category || null,
      featured,
      status
    )
    .run();

  const story = await env.DB
    .prepare(
      `
      SELECT *
      FROM food_stories
      WHERE slug = ?
      LIMIT 1
      `
    )
    .bind(slug)
    .first();

  return json({
    success: true,
    story
  }, 201);
}

async function deleteStory(env, id) {
  const existing = await env.DB
    .prepare(
      `
      SELECT id
      FROM food_stories
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(id)
    .first();

  if (!existing) {
    return json({
      error: "Story not found."
    }, 404);
  }

  await env.DB
    .prepare(
      `
      DELETE FROM food_stories
      WHERE id = ?
      `
    )
    .bind(id)
    .run();

  return json({
    success: true
  });
}


// ============================================================
// UNIQUE SLUG
// ============================================================

async function uniqueSlug(env, table, originalSlug, excludeId = null) {
  const allowedTables = [
    "restaurants",
    "cities",
    "recipes",
    "food_stories"
  ];

  if (!allowedTables.includes(table)) {
    throw new Error("Invalid table.");
  }

  let slug = originalSlug;
  let counter = 2;

  while (true) {
    let query =
      "SELECT id FROM " +
      table +
      " WHERE slug = ?";

    const params = [slug];

    if (excludeId !== null) {
      query += " AND id != ?";
      params.push(excludeId);
    }

    query += " LIMIT 1";

    const existing = await env.DB
      .prepare(query)
      .bind(...params)
      .first();

    if (!existing) {
      return slug;
    }

    slug = originalSlug + "-" + counter;
    counter++;
  }
}


// ============================================================
// PUBLIC RESTAURANT PAGE
// ============================================================

async function restaurantPage(env, slug) {
  const restaurant = await env.DB
    .prepare(
      `
      SELECT
        r.*,
        c.name AS city_name,
        c.country AS country_name
      FROM restaurants r
      LEFT JOIN cities c
        ON c.id = r.city_id
      WHERE r.slug = ?
      AND r.status = 'published'
      LIMIT 1
      `
    )
    .bind(slug)
    .first();

  if (!restaurant) {
    return html(notFoundPage(), 404);
  }

  const categories = await env.DB
    .prepare(
      `
      SELECT category
      FROM restaurant_categories
      WHERE restaurant_id = ?
      ORDER BY category ASC
      `
    )
    .bind(restaurant.id)
    .all();

  const approvedReviews = await env.DB
    .prepare(
      `
      SELECT
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
      ORDER BY created_at DESC
      LIMIT 20
      `
    )
    .bind(restaurant.id)
    .all();

  const photos = await env.DB
    .prepare(
      `
      SELECT
        image_url,
        caption
      FROM restaurant_photos
      WHERE restaurant_id = ?
      ORDER BY sort_order ASC, id ASC
      LIMIT 12
      `
    )
    .bind(restaurant.id)
    .all();

  const categoryHtml =
    (categories.results || []).length > 0
      ? categories.results
          .map(function (item) {
            return (
              '<span class="pill">' +
              escapeHtml(item.category) +
              "</span>"
            );
          })
          .join("")
      : restaurant.cuisine
        ? '<span class="pill">' +
          escapeHtml(restaurant.cuisine) +
          "</span>"
        : "";

  const reviewsHtml =
    (approvedReviews.results || []).length > 0
      ? approvedReviews.results
          .map(function (review) {
            return (
              '<article class="review-card">' +
              '<div class="review-top">' +
              "<strong>" +
              escapeHtml(review.author_name) +
              "</strong>" +
              '<span class="stars">' +
              stars(review.overall_rating) +
              "</span>" +
              "</div>" +
              (review.title
                ? "<h3>" +
                  escapeHtml(review.title) +
                  "</h3>"
                : "") +
              "<p>" +
              escapeHtml(review.body) +
              "</p>" +
              '<small>' +
              escapeHtml(
                formatDate(review.created_at)
              ) +
              "</small>" +
              "</article>"
            );
          })
          .join("")
      : '<div class="empty">No approved reviews yet.</div>';

  const photosHtml =
    (photos.results || []).length > 0
      ? photos.results
          .map(function (photo) {
            const image = safeUrl(photo.image_url);

            if (!image) {
              return "";
            }

            return (
              '<img class="restaurant-photo" src="' +
              escapeHtml(image) +
              '" alt="' +
              escapeHtml(
                photo.caption ||
                restaurant.name
              ) +
              '" loading="lazy">'
            );
          })
          .join("")
      : "";

  const website = safeUrl(restaurant.website);

  const reviewUrl =
    "/api/restaurants/" +
    encodeURIComponent(restaurant.slug) +
    "/reviews";

  return html(
    pageShell(
      escapeHtml(restaurant.name) +
      " | Tastify",
      restaurantPageBody(
        restaurant,
        categoryHtml,
        reviewsHtml,
        photosHtml,
        website,
        reviewUrl
      )
    )
  );
}

function restaurantPageBody(
  restaurant,
  categoryHtml,
  reviewsHtml,
  photosHtml,
  website,
  reviewUrl
) {
  const rating =
    Number(restaurant.rating || 0).toFixed(1);

  return `
<main>
  <section class="restaurant-hero">
    <div class="container">
      <a class="back-link" href="/">← Back to Tastify</a>

      <div class="hero-grid">
        <div>
          <div class="eyebrow">RESTAURANT GUIDE</div>

          <h1>${escapeHtml(restaurant.name)}</h1>

          <div class="rating-large">
            <span class="stars">${stars(
              restaurant.rating
            )}</span>
            <strong>${rating}</strong>
            <span>(${Number(
              restaurant.review_count || 0
            )} reviews)</span>
          </div>

          <div class="pills">
            ${categoryHtml}
            ${
              restaurant.price_range
                ? '<span class="pill">' +
                  escapeHtml(
                    restaurant.price_range
                  ) +
                  "</span>"
                : ""
            }
          </div>

          ${
            restaurant.description
              ? "<p class=\"lead\">" +
                escapeHtml(
                  restaurant.description
                ) +
                "</p>"
              : ""
          }

          <div class="restaurant-meta">
            ${
              restaurant.city_name
                ? "<div><strong>City</strong><br>" +
                  escapeHtml(
                    restaurant.city_name
                  ) +
                  "</div>"
                : ""
            }

            ${
              restaurant.area
                ? "<div><strong>Area</strong><br>" +
                  escapeHtml(
                    restaurant.area
                  ) +
                  "</div>"
                : ""
            }

            ${
              restaurant.address
                ? "<div><strong>Address</strong><br>" +
                  escapeHtml(
                    restaurant.address
                  ) +
                  "</div>"
                : ""
            }

            ${
              restaurant.phone
                ? "<div><strong>Phone</strong><br>" +
                  escapeHtml(
                    restaurant.phone
                  ) +
                  "</div>"
                : ""
            }
          </div>

          ${
            website
              ? '<a class="button" href="' +
                escapeHtml(website) +
                '" target="_blank" rel="noopener noreferrer">Visit Website</a>'
              : ""
          }
        </div>

        <div class="restaurant-art">
          <div class="plate-icon">🍽️</div>
          <span>Tastify</span>
        </div>
      </div>
    </div>
  </section>

  ${
    photosHtml
      ? `
  <section class="section">
    <div class="container">
      <div class="section-heading">
        <div>
          <div class="eyebrow">LOOK AROUND</div>
          <h2>Restaurant Photos</h2>
        </div>
      </div>

      <div class="photo-grid">
        ${photosHtml}
      </div>
    </div>
  </section>
  `
      : ""
  }

  <section class="section">
    <div class="container two-column">

      <div>
        <div class="section-heading">
          <div>
            <div class="eyebrow">COMMUNITY</div>
            <h2>Reviews</h2>
          </div>
        </div>

        <div class="reviews">
          ${reviewsHtml}
        </div>
      </div>

      <aside class="review-form-card">
        <div class="eyebrow">YOUR EXPERIENCE</div>
        <h2>Write a Review</h2>

        <form id="reviewForm">

          <label>
            Your name
            <input
              name="author_name"
              required
              maxlength="100"
            >
          </label>

          <label>
            Email
            <input
              name="author_email"
              type="email"
              maxlength="150"
            >
          </label>

          <label>
            Review title
            <input
              name="title"
              maxlength="150"
            >
          </label>

          <label>
            Overall rating
            <select name="overall_rating" required>
              <option value="">Choose</option>
              <option value="5">★★★★★ — 5</option>
              <option value="4">★★★★☆ — 4</option>
              <option value="3">★★★☆☆ — 3</option>
              <option value="2">★★☆☆☆ — 2</option>
              <option value="1">★☆☆☆☆ — 1</option>
            </select>
          </label>

          <label>
            Your review
            <textarea
              name="body"
              rows="6"
              required
              maxlength="3000"
            ></textarea>
          </label>

          <div class="mini-grid">
            <label>
              Food
              <select name="food_rating">
                <option value="">—</option>
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
            </label>

            <label>
              Service
              <select name="service_rating">
                <option value="">—</option>
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
            </label>

            <label>
              Atmosphere
              <select name="atmosphere_rating">
                <option value="">—</option>
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
            </label>

            <label>
              Value
              <select name="value_rating">
                <option value="">—</option>
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
            </label>
          </div>

          <button class="button" type="submit">
            Submit Review
          </button>

          <div id="reviewMessage"></div>
        </form>
      </aside>

    </div>
  </section>
</main>

<script>
(function () {
  var form = document.getElementById("reviewForm");
  var message = document.getElementById("reviewMessage");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    message.className = "notice";
    message.textContent = "Submitting...";

    var data = Object.fromEntries(
      new FormData(form).entries()
    );

    data.overall_rating = Number(data.overall_rating);

    if (data.food_rating) {
      data.food_rating = Number(data.food_rating);
    } else {
      data.food_rating = null;
    }

    if (data.service_rating) {
      data.service_rating = Number(data.service_rating);
    } else {
      data.service_rating = null;
    }

    if (data.atmosphere_rating) {
      data.atmosphere_rating = Number(data.atmosphere_rating);
    } else {
      data.atmosphere_rating = null;
    }

    if (data.value_rating) {
      data.value_rating = Number(data.value_rating);
    } else {
      data.value_rating = null;
    }

    try {
      var response = await fetch(
        ${JSON.stringify(reviewUrl)},
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        }
      );

      var result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to submit review."
        );
      }

      message.className = "notice success";
      message.textContent =
        "Thank you! Your review has been submitted for moderation.";

      form.reset();
    } catch (error) {
      message.className = "notice error";
      message.textContent = error.message;
    }
  });
})();
</script>
`;
}


// ============================================================
// PUBLIC RECIPE PAGE
// ============================================================

async function recipePage(env, slug) {
  const recipe = await env.DB
    .prepare(
      `
      SELECT *
      FROM recipes
      WHERE slug = ?
      AND status = 'published'
      LIMIT 1
      `
    )
    .bind(slug)
    .first();

  if (!recipe) {
    return html(notFoundPage(), 404);
  }

  const ingredients = await env.DB
    .prepare(
      `
      SELECT
        ingredient,
        quantity
      FROM recipe_ingredients
      WHERE recipe_id = ?
      ORDER BY sort_order ASC, id ASC
      `
    )
    .bind(recipe.id)
    .all();

  const steps = await env.DB
    .prepare(
      `
      SELECT
        step_number,
        instruction
      FROM recipe_steps
      WHERE recipe_id = ?
      ORDER BY step_number ASC
      `
    )
    .bind(recipe.id)
    .all();

  const ingredientsHtml =
    (ingredients.results || []).length > 0
      ? ingredients.results
          .map(function (item) {
            return (
              "<li>" +
              "<strong>" +
              escapeHtml(item.quantity || "") +
              "</strong> " +
              escapeHtml(item.ingredient) +
              "</li>"
            );
          })
          .join("")
      : "<li>Ingredients coming soon.</li>";

  const stepsHtml =
    (steps.results || []).length > 0
      ? steps.results
          .map(function (item) {
            return (
              "<li>" +
              "<strong>Step " +
              escapeHtml(item.step_number) +
              "</strong>" +
              "<p>" +
              escapeHtml(item.instruction) +
              "</p>" +
              "</li>"
            );
          })
          .join("")
      : "<li>Steps coming soon.</li>";

  return html(
    pageShell(
      escapeHtml(recipe.title) +
      " | Tastify",
      `
<main>
  <section class="recipe-hero">
    <div class="container narrow">

      <a class="back-link" href="/">← Back to Tastify</a>

      <div class="eyebrow">EASY RECIPE</div>

      <h1>${escapeHtml(recipe.title)}</h1>

      ${
        recipe.description
          ? "<p class=\"lead\">" +
            escapeHtml(recipe.description) +
            "</p>"
          : ""
      }

      <div class="pills">
        ${
          recipe.category
            ? '<span class="pill">' +
              escapeHtml(recipe.category) +
              "</span>"
            : ""
        }

        ${
          recipe.cuisine
            ? '<span class="pill">' +
              escapeHtml(recipe.cuisine) +
              "</span>"
            : ""
        }

        <span class="pill">
          ${escapeHtml(recipe.difficulty || "Easy")}
        </span>
      </div>

      <div class="recipe-meta">
        <div>
          <strong>Prep</strong>
          ${Number(recipe.prep_minutes || 0)} min
        </div>

        <div>
          <strong>Cook</strong>
          ${Number(recipe.cook_minutes || 0)} min
        </div>

        <div>
          <strong>Serves</strong>
          ${Number(recipe.servings || 1)}
        </div>
      </div>

    </div>
  </section>

  <section class="section">
    <div class="container narrow">

      <div class="recipe-layout">

        <article class="recipe-card">
          <div class="eyebrow">WHAT YOU NEED</div>
          <h2>Ingredients</h2>

          <ul class="ingredients">
            ${ingredientsHtml}
          </ul>
        </article>

        <article class="recipe-card">
          <div class="eyebrow">HOW TO MAKE IT</div>
          <h2>Steps</h2>

          <ol class="steps">
            ${stepsHtml}
          </ol>
        </article>

      </div>

    </div>
  </section>
</main>
`
    )
  );
}


// ============================================================
// PUBLIC STORY PAGE
// ============================================================

async function storyPage(env, slug) {
  const story = await env.DB
    .prepare(
      `
      SELECT *
      FROM food_stories
      WHERE slug = ?
      AND status = 'published'
      LIMIT 1
      `
    )
    .bind(slug)
    .first();

  if (!story) {
    return html(notFoundPage(), 404);
  }

  const content =
    escapeHtml(story.content || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n/g, "<br><br>");

  return html(
    pageShell(
      escapeHtml(story.title) +
      " | Tastify",
      `
<main>
  <section class="story-hero">
    <div class="container narrow">

      <a class="back-link" href="/">← Back to Tastify</a>

      <div class="eyebrow">
        ${escapeHtml(
          story.category || "FOOD STORY"
        )}
      </div>

      <h1>${escapeHtml(story.title)}</h1>

      ${
        story.excerpt
          ? "<p class=\"lead\">" +
            escapeHtml(story.excerpt) +
            "</p>"
          : ""
      }

      <div class="story-meta">
        By ${escapeHtml(
          story.author_name || "Tastify"
        )}
        ·
        ${escapeHtml(
          formatDate(story.created_at)
        )}
      </div>

    </div>
  </section>

  <section class="section">
    <article class="container narrow story-content">
      ${content}
    </article>
  </section>
</main>
`
    )
  );
}


// ============================================================
// HOME PAGE
// ============================================================

async function homePage(env, url) {
  const search = clean(
    url.searchParams.get("search"),
    100
  );

  const city = clean(
    url.searchParams.get("city"),
    100
  );

  const category = clean(
    url.searchParams.get("category"),
    100
  );

  const [
    citiesResult,
    categoryResult,
    restaurantsResult,
    recipesResult,
    storiesResult
  ] = await Promise.all([
    env.DB.prepare(
      `
      SELECT id, name, country, slug
      FROM cities
      ORDER BY name ASC
      `
    ).all(),

    env.DB.prepare(
      `
      SELECT DISTINCT category
      FROM restaurant_categories
      WHERE category IS NOT NULL
      AND category != ''
      ORDER BY category ASC
      LIMIT 50
      `
    ).all(),

    getHomeRestaurants(
      env,
      search,
      city,
      category
    ),

    env.DB.prepare(
      `
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
      ORDER BY featured DESC, rating DESC, created_at DESC
      LIMIT 6
      `
    ).all(),

    env.DB.prepare(
      `
      SELECT
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
      ORDER BY featured DESC, created_at DESC
      LIMIT 4
      `
    ).all()
  ]);

  const cities = citiesResult.results || [];
  const categories = categoryResult.results || [];
  const restaurants = restaurantsResult.results || [];
  const recipes = recipesResult.results || [];
  const stories = storiesResult.results || [];

  const restaurantCards =
    restaurants.length > 0
      ? restaurants
          .map(function (restaurant) {
            return restaurantCard(
              restaurant
            );
          })
          .join("")
      : `
        <div class="empty full-width">
          No restaurants found for your search.
        </div>
      `;

  const recipeCards =
    recipes.length > 0
      ? recipes
          .map(function (recipe) {
            return recipeCard(recipe);
          })
          .join("")
      : `
        <div class="empty full-width">
          Recipes are coming soon.
        </div>
      `;

  const storyCards =
    stories.length > 0
      ? stories
          .map(function (story) {
            return storyCard(story);
          })
          .join("")
      : `
        <div class="empty full-width">
          Food stories are coming soon.
        </div>
      `;

  const cityOptions = cities
    .map(function (item) {
      return (
        '<option value="' +
        escapeHtml(item.slug) +
        '"' +
        (city === item.slug ? " selected" : "") +
        ">" +
        escapeHtml(item.name) +
        "</option>"
      );
    })
    .join("");

  const categoryOptions = categories
    .map(function (item) {
      return (
        '<option value="' +
        escapeHtml(item.category) +
        '"' +
        (category === item.category
          ? " selected"
          : "") +
        ">" +
        escapeHtml(item.category) +
        "</option>"
      );
    })
    .join("");

  return html(
    pageShell(
      "Tastify — Discover With Tastify",
      `
<header class="site-header">
  <div class="container nav">

    <a class="brand" href="/">
      <span class="brand-mark">T</span>
      <span>
        <strong>Tastify</strong>
        <small>Discover With Tastify</small>
      </span>
    </a>

    <nav>
      <a href="#restaurants">Restaurants</a>
      <a href="#recipes">Recipes</a>
      <a href="#stories">Stories</a>
      <a href="/admin">Admin</a>
    </nav>

  </div>
</header>

<main>

  <section class="home-hero">
    <div class="container">

      <div class="eyebrow">TASTIFY</div>

      <h1>
        Discover food.<br>
        Discover places.<br>
        <em>Discover your next favourite.</em>
      </h1>

      <p class="hero-copy">
        Recipes for home cooks, restaurant discoveries,
        honest reviews and stories worth tasting.
      </p>

      <form class="search-panel" method="GET" action="/">

        <input
          name="search"
          value="${escapeHtml(search)}"
          placeholder="Search restaurants, cuisine or area..."
          maxlength="100"
        >

        <select name="city">
          <option value="">All cities</option>
          ${cityOptions}
        </select>

        <select name="category">
          <option value="">All categories</option>
          ${categoryOptions}
        </select>

        <button class="button" type="submit">
          Discover
        </button>

      </form>

    </div>
  </section>

  <section class="section" id="restaurants">
    <div class="container">

      <div class="section-heading">
        <div>
          <div class="eyebrow">EXPLORE</div>
          <h2>Restaurant Guide</h2>
        </div>

        <span class="section-count">
          ${restaurants.length} found
        </span>
      </div>

      <div class="card-grid">
        ${restaurantCards}
      </div>

    </div>
  </section>

  <section class="section cream" id="recipes">
    <div class="container">

      <div class="section-heading">
        <div>
          <div class="eyebrow">FROM OUR KITCHEN</div>
          <h2>Easy Recipes</h2>
        </div>

        <a href="/api/recipes">
          View all
        </a>
      </div>

      <div class="card-grid">
        ${recipeCards}
      </div>

    </div>
  </section>

  <section class="section" id="stories">
    <div class="container">

      <div class="section-heading">
        <div>
          <div class="eyebrow">FOOD & CULTURE</div>
          <h2>Food Stories</h2>
        </div>

        <a href="/api/stories">
          View all
        </a>
      </div>

      <div class="story-grid">
        ${storyCards}
      </div>

    </div>
  </section>

  <section class="brand-statement">
    <div class="container narrow">

      <div class="eyebrow">THE TASTIFY IDEA</div>

      <h2>
        IN THE REALMS WHERE FOOD AND ART UNITE,
        WE ASPIRE TO BE MAGICIANS.
      </h2>

    </div>
  </section>

</main>

<footer class="site-footer">
  <div class="container footer-inner">

    <div>
      <strong>Tastify</strong>
      <p>Discover With Tastify.</p>
    </div>

    <div>
      <small>
        Food · Recipes · Restaurants · Stories
      </small>
    </div>

  </div>
</footer>
`
    )
  );
}

async function getHomeRestaurants(
  env,
  search,
  city,
  category
) {
  let sql = `
    SELECT
      r.*,
      c.name AS city_name,
      c.slug AS city_slug
    FROM restaurants r
    LEFT JOIN cities c
      ON c.id = r.city_id
    WHERE r.status = 'published'
  `;

  const params = [];

  if (search) {
    const q = "%" + search + "%";

    sql += `
      AND (
        r.name LIKE ?
        OR r.description LIKE ?
        OR r.cuisine LIKE ?
        OR r.area LIKE ?
      )
    `;

    params.push(q, q, q, q);
  }

  if (city) {
    sql += `
      AND c.slug = ?
    `;

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
    ORDER BY
      r.featured DESC,
      r.rating DESC,
      r.name ASC
    LIMIT 12
  `;

  const result = await env.DB
    .prepare(sql)
    .bind(...params)
    .all();

  return result.results || [];
}


// ============================================================
// CARD COMPONENTS
// ============================================================

function restaurantCard(restaurant) {
  return `
<article class="card restaurant-card">

  <div class="card-art">
    <span>🍴</span>
  </div>

  <div class="card-body">

    <div class="card-topline">
      <span class="eyebrow">
        ${escapeHtml(
          restaurant.city_name || "Pakistan"
        )}
      </span>

      ${
        restaurant.featured
          ? '<span class="featured">FEATURED</span>'
          : ""
      }
    </div>

    <h3>
      <a href="/restaurant/${encodeURIComponent(
        restaurant.slug
      )}">
        ${escapeHtml(restaurant.name)}
      </a>
    </h3>

    ${
      restaurant.area
        ? "<p class=\"muted\">" +
          escapeHtml(restaurant.area) +
          "</p>"
        : ""
    }

    <div class="card-rating">
      <span class="stars">
        ${stars(restaurant.rating)}
      </span>

      <strong>
        ${Number(
          restaurant.rating || 0
        ).toFixed(1)}
      </strong>

      <small>
        (${Number(
          restaurant.review_count || 0
        )})
      </small>
    </div>

    <div class="pills">
      ${
        restaurant.cuisine
          ? '<span class="pill">' +
            escapeHtml(restaurant.cuisine) +
            "</span>"
          : ""
      }

      ${
        restaurant.price_range
          ? '<span class="pill">' +
            escapeHtml(
              restaurant.price_range
            ) +
            "</span>"
          : ""
      }
    </div>

  </div>
</article>
`;
}

function recipeCard(recipe) {
  return `
<article class="card">

  <div class="card-art recipe-art">
    <span>🥘</span>
  </div>

  <div class="card-body">

    <div class="eyebrow">
      ${escapeHtml(
        recipe.category || "RECIPE"
      )}
    </div>

    <h3>
      <a href="/recipe/${encodeURIComponent(
        recipe.slug
      )}">
        ${escapeHtml(recipe.title)}
      </a>
    </h3>

    ${
      recipe.description
        ? "<p>" +
          escapeHtml(
            recipe.description
          ) +
          "</p>"
        : ""
    }

    <div class="recipe-card-meta">
      ${Number(recipe.prep_minutes || 0) +
        Number(recipe.cook_minutes || 0)}
      min
      ·
      ${Number(recipe.servings || 1)} servings
      ·
      ${escapeHtml(
        recipe.difficulty || "Easy"
      )}
    </div>

  </div>
</article>
`;
}

function storyCard(story) {
  return `
<article class="story-card">

  <div class="story-card-art">
    <span>✦</span>
  </div>

  <div class="story-card-body">

    <div class="eyebrow">
      ${escapeHtml(
        story.category || "FOOD STORY"
      )}
    </div>

    <h3>
      <a href="/story/${encodeURIComponent(
        story.slug
      )}">
        ${escapeHtml(story.title)}
      </a>
    </h3>

    ${
      story.excerpt
        ? "<p>" +
          escapeHtml(story.excerpt) +
          "</p>"
        : ""
    }

    <small>
      ${escapeHtml(
        story.author_name || "Tastify"
      )}
      ·
      ${escapeHtml(
        formatDate(story.created_at)
      )}
    </small>

  </div>
</article>
`;
}

function stars(value) {
  const rating = Number(value || 0);

  let result = "";

  for (let i = 1; i <= 5; i++) {
    result += i <= Math.round(rating)
      ? "★"
      : "☆";
  }

  return result;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
    return new Date(value + "Z")
      .toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
  } catch {
    return String(value);
  }
}


// ============================================================
// ADMIN LOGIN PAGE
// ============================================================

function adminLoginPage() {
  return pageShell(
    "Tastify Admin Login",
    `
<main class="admin-login-page">

  <div class="login-card">

    <div class="brand login-brand">
      <span class="brand-mark">T</span>
      <span>
        <strong>Tastify</strong>
        <small>Admin</small>
      </span>
    </div>

    <div class="eyebrow">PRIVATE AREA</div>

    <h1>Admin Login</h1>

    <p>
      Sign in to manage restaurants, reviews,
      recipes, stories and cities.
    </p>

    <form id="loginForm">

      <label>
        Admin password
        <input
          id="password"
          type="password"
          autocomplete="current-password"
          required
        >
      </label>

      <button class="button" type="submit">
        Sign In
      </button>

      <div id="loginMessage"></div>

    </form>

    <a class="back-link" href="/">
      ← Back to Tastify
    </a>

  </div>

</main>

<script>
(function () {
  var form = document.getElementById("loginForm");
  var message = document.getElementById("loginMessage");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    message.className = "notice";
    message.textContent = "Signing in...";

    try {
      var response = await fetch(
        "/admin/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            password:
              document.getElementById("password").value
          })
        }
      );

      var result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Login failed."
        );
      }

      window.location.href = "/admin";
    } catch (error) {
      message.className = "notice error";
      message.textContent = error.message;
    }
  });
})();
</script>
`
  );
}


// ============================================================
// ADMIN DASHBOARD
// ============================================================

async function adminDashboard(env) {
  const [
    statsResult,
    pendingResult,
    restaurantsResult,
    citiesResult,
    recipesResult,
    storiesResult
  ] = await Promise.all([
    adminStatsObject(env),

    env.DB.prepare(
      `
      SELECT
        rv.*,
        r.name AS restaurant_name
      FROM reviews rv
      JOIN restaurants r
        ON r.id = rv.restaurant_id
      WHERE rv.status = 'pending'
      ORDER BY rv.created_at DESC
      LIMIT 100
      `
    ).all(),

    env.DB.prepare(
      `
      SELECT
        r.*,
        c.name AS city_name
      FROM restaurants r
      LEFT JOIN cities c
        ON c.id = r.city_id
      ORDER BY r.created_at DESC
      LIMIT 100
      `
    ).all(),

    env.DB.prepare(
      `
      SELECT *
      FROM cities
      ORDER BY name ASC
      `
    ).all(),

    env.DB.prepare(
      `
      SELECT *
      FROM recipes
      ORDER BY created_at DESC
      LIMIT 100
      `
    ).all(),

    env.DB.prepare(
      `
      SELECT *
      FROM food_stories
      ORDER BY created_at DESC
      LIMIT 100
      `
    ).all()
  ]);

  const pending = pendingResult.results || [];
  const restaurants =
    restaurantsResult.results || [];
  const cities = citiesResult.results || [];
  const recipes = recipesResult.results || [];
  const stories = storiesResult.results || [];

  const pendingHtml =
    pending.length > 0
      ? pending
          .map(function (review) {
            return (
              '<article class="admin-review">' +
              '<div class="admin-review-header">' +
              "<div>" +
              "<strong>" +
              escapeHtml(
                review.restaurant_name
              ) +
              "</strong>" +
              "<br>" +
              "<span>" +
              escapeHtml(
                review.author_name
              ) +
              "</span>" +
              "</div>" +
              '<span class="stars">' +
              stars(review.overall_rating) +
              "</span>" +
              "</div>" +
              (review.title
                ? "<h3>" +
                  escapeHtml(review.title) +
                  "</h3>"
                : "") +
              "<p>" +
              escapeHtml(review.body) +
              "</p>" +
              '<div class="admin-actions">' +
              '<button class="button approve-btn" data-id="' +
              Number(review.id) +
              '">Approve</button>' +
              '<button class="button danger reject-btn" data-id="' +
              Number(review.id) +
              '">Reject</button>' +
              "</div>" +
              "</article>"
            );
          })
          .join("")
      : '<div class="empty">No pending reviews.</div>';

  const restaurantRows =
    restaurants.length > 0
      ? restaurants
          .map(function (restaurant) {
            return (
              "<tr>" +
              "<td>" +
              escapeHtml(
                restaurant.name
              ) +
              "</td>" +
              "<td>" +
              escapeHtml(
                restaurant.city_name || "—"
              ) +
              "</td>" +
              "<td>" +
              Number(
                restaurant.rating || 0
              ).toFixed(1) +
              "</td>" +
              "<td>" +
              Number(
                restaurant.review_count || 0
              ) +
              "</td>" +
              "<td>" +
              escapeHtml(
                restaurant.status
              ) +
              "</td>" +
              "</tr>"
            );
          })
          .join("")
      : '<tr><td colspan="5">No restaurants.</td></tr>';

  const cityRows =
    cities.length > 0
      ? cities
          .map(function (city) {
            return (
              "<tr>" +
              "<td>" +
              escapeHtml(city.name) +
              "</td>" +
              "<td>" +
              escapeHtml(city.country) +
              "</td>" +
              "<td>" +
              escapeHtml(city.slug) +
              "</td>" +
              "</tr>"
            );
          })
          .join("")
      : '<tr><td colspan="3">No cities.</td></tr>';

  const recipeRows =
    recipes.length > 0
      ? recipes
          .map(function (recipe) {
            return (
              "<tr>" +
              "<td>" +
              escapeHtml(recipe.title) +
              "</td>" +
              "<td>" +
              escapeHtml(
                recipe.category || "—"
              ) +
              "</td>" +
              "<td>" +
              escapeHtml(
                recipe.status
              ) +
              "</td>" +
              "</tr>"
            );
          })
          .join("")
      : '<tr><td colspan="3">No recipes.</td></tr>';

  const storyRows =
    stories.length > 0
      ? stories
          .map(function (story) {
            return (
              "<tr>" +
              "<td>" +
              escapeHtml(story.title) +
              "</td>" +
              "<td>" +
              escapeHtml(
                story.category || "—"
              ) +
              "</td>" +
              "<td>" +
              escapeHtml(
                story.status
              ) +
              "</td>" +
              "</tr>"
            );
          })
          .join("")
      : '<tr><td colspan="3">No stories.</td></tr>';

  return pageShell(
    "Tastify Admin Dashboard",
    `
<header class="site-header">
  <div class="container nav">

    <a class="brand" href="/">
      <span class="brand-mark">T</span>
      <span>
        <strong>Tastify</strong>
        <small>Admin Dashboard</small>
      </span>
    </a>

    <button
      id="logoutBtn"
      class="button secondary"
      type="button"
    >
      Logout
    </button>

  </div>
</header>

<main class="admin-page">

  <div class="container">

    <div class="admin-heading">
      <div>
        <div class="eyebrow">CONTROL CENTER</div>
        <h1>Tastify Dashboard</h1>
        <p>
          Manage your food discovery platform.
        </p>
      </div>
    </div>

    <section class="stats-grid">

      <div class="stat-card">
        <span>Restaurants</span>
        <strong>${statsResult.restaurants}</strong>
      </div>

      <div class="stat-card highlight">
        <span>Pending Reviews</span>
        <strong>${statsResult.pending_reviews}</strong>
      </div>

      <div class="stat-card">
        <span>Approved Reviews</span>
        <strong>${statsResult.approved_reviews}</strong>
      </div>

      <div class="stat-card">
        <span>Recipes</span>
        <strong>${statsResult.recipes}</strong>
      </div>

      <div class="stat-card">
        <span>Stories</span>
        <strong>${statsResult.stories}</strong>
      </div>

      <div class="stat-card">
        <span>Cities</span>
        <strong>${statsResult.cities}</strong>
      </div>

    </section>

    <section class="admin-section">

      <div class="section-heading">
        <div>
          <div class="eyebrow">MODERATION</div>
          <h2>Pending Reviews</h2>
        </div>
      </div>

      <div id="pendingReviews">
        ${pendingHtml}
      </div>

      <div id="actionMessage"></div>

    </section>

    <section class="admin-section">

      <div class="section-heading">
        <div>
          <div class="eyebrow">DIRECTORY</div>
          <h2>Restaurants</h2>
        </div>
      </div>

      <div class="table-wrap">

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>City</th>
              <th>Rating</th>
              <th>Reviews</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            ${restaurantRows}
          </tbody>
        </table>

      </div>

    </section>

    <section class="admin-section">

      <div class="section-heading">
        <div>
          <div class="eyebrow">LOCATIONS</div>
          <h2>Cities</h2>
        </div>
      </div>

      <div class="table-wrap">

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Country</th>
              <th>Slug</th>
            </tr>
          </thead>

          <tbody>
            ${cityRows}
          </tbody>
        </table>

      </div>

    </section>

    <section class="admin-section">

      <div class="section-heading">
        <div>
          <div class="eyebrow">CONTENT</div>
          <h2>Recipes</h2>
        </div>
      </div>

      <div class="table-wrap">

        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            ${recipeRows}
          </tbody>
        </table>

      </div>

    </section>

    <section class="admin-section">

      <div class="section-heading">
        <div>
          <div class="eyebrow">EDITORIAL</div>
          <h2>Food Stories</h2>
        </div>
      </div>

      <div class="table-wrap">

        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            ${storyRows}
          </tbody>
        </table>

      </div>

    </section>

  </div>

</main>

<script>
(function () {

  async function moderate(id, action) {
    var message =
      document.getElementById("actionMessage");

    message.className = "notice";
    message.textContent = "Updating review...";

    try {
      var response = await fetch(
        "/api/admin/reviews/" +
        id +
        "/" +
        action,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      var result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Unable to update review."
        );
      }

      message.className = "notice success";
      message.textContent =
        "Review " +
        action +
        "d successfully. Reloading...";

      setTimeout(function () {
        window.location.reload();
      }, 500);

    } catch (error) {
      message.className = "notice error";
      message.textContent = error.message;
    }
  }

  document
    .querySelectorAll(".approve-btn")
    .forEach(function (button) {
      button.addEventListener(
        "click",
        function () {
          moderate(
            button.getAttribute("data-id"),
            "approve"
          );
        }
      );
    });

  document
    .querySelectorAll(".reject-btn")
    .forEach(function (button) {
      button.addEventListener(
        "click",
        function () {
          moderate(
            button.getAttribute("data-id"),
            "reject"
          );
        }
      );
    });

  document
    .getElementById("logoutBtn")
    .addEventListener(
      "click",
      async function () {

        await fetch(
          "/admin/logout",
          {
            method: "POST"
          }
        );

        window.location.href =
          "/admin/login";
      }
    );

})();
</script>
`
  );
}

async function adminStatsObject(env) {
  const [
    restaurants,
    pendingReviews,
    approvedReviews,
    recipes,
    stories,
    cities
  ] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM restaurants`
    ).first(),

    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM reviews WHERE status = 'pending'`
    ).first(),

    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM reviews WHERE status = 'approved'`
    ).first(),

    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM recipes`
    ).first(),

    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM food_stories`
    ).first(),

    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM cities`
    ).first()
  ]);

  return {
    restaurants: Number(
      restaurants?.count || 0
    ),

    pending_reviews: Number(
      pendingReviews?.count || 0
    ),

    approved_reviews: Number(
      approvedReviews?.count || 0
    ),

    recipes: Number(
      recipes?.count || 0
    ),

    stories: Number(
      stories?.count || 0
    ),

    cities: Number(
      cities?.count || 0
    )
  };
}


// ============================================================
// PAGE SHELL
// ============================================================

function pageShell(title, body) {
  return `
<!DOCTYPE html>
<html lang="en">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <meta
    name="description"
    content="Tastify — discover recipes, restaurants, reviews and food stories."
  >

  <title>${escapeHtml(title)}</title>

  <style>

    :root {
      --emerald: #087f6c;
      --deep-emerald: #075c50;
      --cream: #fffaf0;
      --gold: #d8a83e;
      --orange: #f28c28;
      --ink: #18231f;
      --muted: #68736e;
      --white: #ffffff;
      --border: #e4e0d5;
      --danger: #b73b32;
      --success: #217a55;
      --shadow:
        0 12px 35px rgba(20, 40, 32, 0.08);
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      color: var(--ink);
      background: var(--white);
      font-family:
        Arial,
        Helvetica,
        sans-serif;
      line-height: 1.6;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    img {
      max-width: 100%;
    }

    button,
    input,
    select,
    textarea {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    h1,
    h2,
    h3 {
      font-family:
        Georgia,
        "Times New Roman",
        serif;
      line-height: 1.1;
      margin-top: 0;
    }

    h1 {
      font-size: clamp(2.6rem, 7vw, 5.8rem);
      letter-spacing: -0.04em;
      margin-bottom: 1.2rem;
    }

    h2 {
      font-size: clamp(2rem, 4vw, 3.3rem);
      letter-spacing: -0.03em;
    }

    h3 {
      font-size: 1.35rem;
    }

    p {
      color: var(--muted);
    }

    .container {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
    }

    .container.narrow {
      width: min(820px, calc(100% - 32px));
    }

    .site-header {
      position: relative;
      z-index: 20;
      border-bottom: 1px solid var(--border);
      background: rgba(255,255,255,0.96);
    }

    .nav {
      min-height: 76px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .nav nav {
      display: flex;
      align-items: center;
      gap: 24px;
      font-size: 0.92rem;
      font-weight: 700;
    }

    .nav nav a:hover {
      color: var(--emerald);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-family:
        Georgia,
        "Times New Roman",
        serif;
    }

    .brand-mark {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      color: var(--white);
      background: var(--emerald);
      font-weight: 700;
      font-size: 1.4rem;
    }

    .brand strong {
      display: block;
      font-size: 1.4rem;
      line-height: 1;
    }

    .brand small {
      display: block;
      margin-top: 3px;
      color: var(--muted);
      font-family: Arial, sans-serif;
      font-size: 0.63rem;
      letter-spacing: 0.05em;
    }

    .eyebrow {
      color: var(--emerald);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.16em;
      margin-bottom: 10px;
    }

    .home-hero {
      padding: 90px 0 100px;
      background:
        radial-gradient(
          circle at 85% 20%,
          rgba(216,168,62,0.22),
          transparent 30%
        ),
        linear-gradient(
          135deg,
          #f5fff9 0%,
          #fffaf0 100%
        );
    }

    .home-hero h1 em {
      color: var(--emerald);
      font-weight: 400;
    }

    .hero-copy {
      width: min(650px, 100%);
      font-size: 1.15rem;
      margin-bottom: 30px;
    }

    .search-panel {
      display: grid;
      grid-template-columns:
        minmax(200px, 2fr)
        minmax(150px, 1fr)
        minmax(150px, 1fr)
        auto;
      gap: 10px;
      padding: 10px;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: var(--shadow);
      width: min(1000px, 100%);
    }

    input,
    select,
    textarea {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
      background: var(--white);
      color: var(--ink);
      outline: none;
    }

    input:focus,
    select:focus,
    textarea:focus {
      border-color: var(--emerald);
      box-shadow:
        0 0 0 3px rgba(8,127,108,0.1);
    }

    textarea {
      resize: vertical;
    }

    label {
      display: grid;
      gap: 7px;
      margin-bottom: 16px;
      font-size: 0.88rem;
      font-weight: 700;
    }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
      padding: 11px 18px;
      border: 0;
      border-radius: 10px;
      background: var(--emerald);
      color: var(--white);
      font-weight: 800;
      transition:
        transform 0.15s ease,
        background 0.15s ease;
    }

    .button:hover {
      transform: translateY(-1px);
      background: var(--deep-emerald);
    }

    .button.secondary {
      background: var(--ink);
    }

    .button.danger {
      background: var(--danger);
    }

    .section {
      padding: 80px 0;
    }

    .section.cream {
      background: var(--cream);
    }

    .section-heading {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 30px;
    }

    .section-heading h2 {
      margin-bottom: 0;
    }

    .section-heading > a {
      color: var(--emerald);
      font-weight: 800;
    }

    .section-count {
      color: var(--muted);
      font-size: 0.9rem;
    }

    .card-grid {
      display: grid;
      grid-template-columns:
        repeat(3, minmax(0, 1fr));
      gap: 22px;
    }

    .card {
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--white);
      box-shadow:
        0 5px 20px rgba(20,40,32,0.04);
    }

    .card-art {
      min-height: 190px;
      display: grid;
      place-items: center;
      background:
        linear-gradient(
          135deg,
          var(--deep-emerald),
          var(--emerald)
        );
      color: var(--white);
      font-size: 4rem;
    }

    .recipe-art {
      background:
        linear-gradient(
          135deg,
          #e8c66d,
          var(--orange)
        );
    }

    .card-body {
      padding: 22px;
    }

    .card-body h3 {
      margin-bottom: 8px;
    }

    .card-body h3 a:hover {
      color: var(--emerald);
    }

    .card-topline {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .featured {
      color: var(--orange);
      font-size: 0.65rem;
      font-weight: 900;
      letter-spacing: 0.1em;
    }

    .muted {
      color: var(--muted);
      margin-top: 0;
    }

    .card-rating,
    .rating-large {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stars {
      color: var(--gold);
      letter-spacing: 0.08em;
      white-space: nowrap;
    }

    .pills {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 14px;
    }

    .pill {
      display: inline-flex;
      padding: 5px 9px;
      border-radius: 999px;
      background: #edf6f3;
      color: var(--deep-emerald);
      font-size: 0.72rem;
      font-weight: 800;
    }

    .recipe-card-meta {
      color: var(--muted);
      font-size: 0.84rem;
      margin-top: 14px;
    }

    .story-grid {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 22px;
    }

    .story-card {
      display: grid;
      grid-template-columns: 180px 1fr;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--white);
    }

    .story-card-art {
      display: grid;
      place-items: center;
      min-height: 220px;
      background: var(--deep-emerald);
      color: var(--gold);
      font-family: Georgia, serif;
      font-size: 4rem;
    }

    .story-card-body {
      padding: 24px;
    }

    .story-card-body h3 {
      margin-bottom: 8px;
    }

    .brand-statement {
      padding: 100px 0;
      background:
        linear-gradient(
          135deg,
          var(--deep-emerald),
          var(--emerald)
        );
      color: var(--white);
      text-align: center;
    }

    .brand-statement .eyebrow {
      color: var(--gold);
    }

    .brand-statement h2 {
      margin-bottom: 0;
      font-size: clamp(1.8rem, 4vw, 3.6rem);
    }

    .site-footer {
      padding: 35px 0;
      background: #10201c;
      color: var(--white);
    }

    .footer-inner {
      display: flex;
      justify-content: space-between;
      gap: 30px;
    }

    .footer-inner p,
    .footer-inner small {
      color: #b9c4bf;
    }

    .restaurant-hero,
    .recipe-hero,
    .story-hero {
      padding: 70px 0;
      background:
        linear-gradient(
          135deg,
          #f4fff9,
          #fffaf0
        );
    }

    .back-link {
      display: inline-block;
      color: var(--emerald);
      font-weight: 800;
      margin-bottom: 30px;
    }

    .hero-grid {
      display: grid;
      grid-template-columns:
        minmax(0, 2fr)
        minmax(250px, 1fr);
      gap: 50px;
      align-items: center;
    }

    .lead {
      font-size: 1.12rem;
      max-width: 760px;
    }

    .rating-large {
      margin: 18px 0;
      font-size: 1rem;
    }

    .rating-large strong {
      font-size: 1.4rem;
    }

    .restaurant-meta {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin: 30px 0;
    }

    .restaurant-meta div {
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--white);
      color: var(--muted);
    }

    .restaurant-meta strong {
      color: var(--ink);
    }

    .restaurant-art {
      min-height: 340px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 10px;
      border-radius: 24px;
      background:
        linear-gradient(
          145deg,
          var(--deep-emerald),
          var(--emerald)
        );
      color: var(--white);
      box-shadow: var(--shadow);
    }

    .plate-icon {
      font-size: 6rem;
    }

    .photo-grid {
      display: grid;
      grid-template-columns:
        repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .restaurant-photo {
      width: 100%;
      height: 180px;
      object-fit: cover;
      border-radius: 12px;
      border: 1px solid var(--border);
    }

    .two-column {
      display: grid;
      grid-template-columns:
        minmax(0, 1.5fr)
        minmax(300px, 0.8fr);
      gap: 40px;
      align-items: start;
    }

    .review-card,
    .review-form-card,
    .recipe-card {
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--white);
      padding: 22px;
      margin-bottom: 14px;
    }

    .review-form-card {
      position: sticky;
      top: 20px;
      box-shadow: var(--shadow);
    }

    .review-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
    }

    .mini-grid {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .mini-grid label {
      margin-bottom: 5px;
    }

    .notice {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 10px;
      background: #eef4f1;
      color: var(--ink);
      font-size: 0.9rem;
    }

    .notice.success {
      background: #e8f6ee;
      color: var(--success);
    }

    .notice.error {
      background: #fae9e7;
      color: var(--danger);
    }

    .empty {
      padding: 30px;
      border: 1px dashed var(--border);
      border-radius: 14px;
      color: var(--muted);
      text-align: center;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .recipe-layout {
      display: grid;
      grid-template-columns:
        minmax(260px, 0.8fr)
        minmax(0, 1.2fr);
      gap: 22px;
    }

    .ingredients {
      margin: 0;
      padding-left: 22px;
    }

    .ingredients li {
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }

    .steps {
      margin: 0;
      padding-left: 24px;
    }

    .steps li {
      padding-left: 8px;
      margin-bottom: 22px;
    }

    .steps p {
      margin: 5px 0 0;
    }

    .story-content {
      font-size: 1.1rem;
    }

    .story-meta {
      color: var(--muted);
      font-size: 0.9rem;
    }

    .admin-login-page {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 30px;
      background:
        linear-gradient(
          135deg,
          #effcf7,
          #fffaf0
        );
    }

    .login-card {
      width: min(450px, 100%);
      padding: 35px;
      border: 1px solid var(--border);
      border-radius: 22px;
      background: var(--white);
      box-shadow: var(--shadow);
    }

    .login-brand {
      margin-bottom: 35px;
    }

    .admin-page {
      padding: 60px 0 100px;
      background: #f7f8f6;
    }

    .admin-heading {
      margin-bottom: 35px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns:
        repeat(6, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 45px;
    }

    .stat-card {
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: 15px;
      background: var(--white);
    }

    .stat-card span {
      display: block;
      color: var(--muted);
      font-size: 0.78rem;
      margin-bottom: 5px;
    }

    .stat-card strong {
      display: block;
      font-family: Georgia, serif;
      font-size: 2rem;
    }

    .stat-card.highlight {
      border-color: var(--gold);
      background: #fffaf0;
    }

    .admin-section {
      margin-bottom: 50px;
      padding: 28px;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--white);
    }

    .admin-review {
      padding: 22px 0;
      border-bottom: 1px solid var(--border);
    }

    .admin-review:last-child {
      border-bottom: 0;
    }

    .admin-review-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
    }

    .admin-actions {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }

    .table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 600px;
    }

    th,
    td {
      padding: 13px 10px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 0.9rem;
    }

    th {
      color: var(--muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    @media (max-width: 900px) {

      .card-grid {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }

      .stats-grid {
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
      }

      .search-panel {
        grid-template-columns:
          1fr 1fr;
      }

      .hero-grid,
      .two-column,
      .recipe-layout {
        grid-template-columns: 1fr;
      }

      .review-form-card {
        position: static;
      }

      .photo-grid {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 650px) {

      .container {
        width: min(
          100% - 22px,
          1180px
        );
      }

      .nav {
        padding: 12px 0;
        align-items: flex-start;
      }

      .nav nav {
        display: none;
      }

      .home-hero {
        padding: 60px 0 70px;
      }

      h1 {
        font-size: 2.8rem;
      }

      .section {
        padding: 60px 0;
      }

      .search-panel {
        grid-template-columns: 1fr;
      }

      .card-grid,
      .story-grid {
        grid-template-columns: 1fr;
      }

      .story-card {
        grid-template-columns: 1fr;
      }

      .story-card-art {
        min-height: 150px;
      }

      .restaurant-meta {
        grid-template-columns: 1fr;
      }

      .photo-grid {
        grid-template-columns: 1fr 1fr;
      }

      .mini-grid {
        grid-template-columns: 1fr 1fr;
      }

      .stats-grid {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }

      .admin-section {
        padding: 18px;
      }

      .footer-inner {
        flex-direction: column;
      }

      .admin-review-header {
        flex-direction: column;
      }

      .admin-actions {
        flex-direction: column;
      }

      .admin-actions .button {
        width: 100%;
      }
    }

  </style>

</head>

<body>

${body}

</body>

</html>
`;
}


// ============================================================
// ERROR / 404 PAGES
// ============================================================

function errorPage(title, message) {
  return pageShell(
    "Tastify Error",
    `
<main class="admin-login-page">

  <div class="login-card">

    <div class="eyebrow">TASTIFY</div>

    <h1>${escapeHtml(title)}</h1>

    <p>${escapeHtml(message)}</p>

    <a class="button" href="/">
      Back to Tastify
    </a>

  </div>

</main>
`
  );
}

function notFoundPage() {
  return pageShell(
    "Page Not Found | Tastify",
    `
<main class="admin-login-page">

  <div class="login-card">

    <div class="eyebrow">404</div>

    <h1>That page isn't on the menu.</h1>

    <p>
      The page you are looking for does not exist
      or may have moved.
    </p>

    <a class="button" href="/">
      Discover Tastify
    </a>

  </div>

</main>
`
  );
}
