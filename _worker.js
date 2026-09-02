const SESSION_COOKIE = "tastify_admin";
const SESSION_HOURS = 12;

/* =========================================================
   TASTIFY WORKER
   ========================================================= */

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const method = request.method;
      const path = url.pathname;

      /* -----------------------------------------------------
         PUBLIC API
      ----------------------------------------------------- */

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

      /* -----------------------------------------------------
         PUBLIC RESTAURANT REVIEW
      ----------------------------------------------------- */

      if (
        path.startsWith("/api/restaurants/") &&
        path.endsWith("/reviews") &&
        method === "POST"
      ) {
        const parts = path.split("/").filter(Boolean);
        const slug = parts[2];
        return await submitReview(env, request, slug);
      }

      /* -----------------------------------------------------
         ADMIN LOGIN / LOGOUT
      ----------------------------------------------------- */

      if (path === "/admin/login" && method === "POST") {
        return await adminLogin(env, request);
      }

      if (path === "/admin/logout" && method === "POST") {
        return await adminLogout(env, request);
      }

      /* -----------------------------------------------------
         ADMIN PAGE
      ----------------------------------------------------- */

      if (path === "/admin" && method === "GET") {
        if (!(await isAdminAuthenticated(request, env))) {
          return html(loginPage());
        }

        return html(adminDashboard());
      }

      /* -----------------------------------------------------
         ADMIN API AUTHENTICATION
      ----------------------------------------------------- */

      if (path.startsWith("/api/admin/")) {
        if (!(await isAdminAuthenticated(request, env))) {
          return json(
            {
              ok: false,
              error: "Unauthorized"
            },
            401
          );
        }

        if (!sameOrigin(request)) {
          return json(
            {
              ok: false,
              error: "Invalid request origin"
            },
            403
          );
        }
      }

      /* -----------------------------------------------------
         ADMIN STATS
      ----------------------------------------------------- */

      if (path === "/api/admin/stats" && method === "GET") {
        return await adminStats(env);
      }

      /* -----------------------------------------------------
         ADMIN REVIEWS
      ----------------------------------------------------- */

      if (path === "/api/admin/reviews" && method === "GET") {
        return await adminReviews(env, url);
      }

      if (
        path.startsWith("/api/admin/reviews/") &&
        method === "POST"
      ) {
        const parts = path.split("/").filter(Boolean);
        const reviewId = Number(parts[3]);

        if (parts[4] === "approve") {
          return await approveReview(env, reviewId);
        }

        if (parts[4] === "reject") {
          return await rejectReview(env, reviewId);
        }
      }

      /* -----------------------------------------------------
         ADMIN RESTAURANTS
      ----------------------------------------------------- */

      if (path === "/api/admin/restaurants" && method === "GET") {
        return await adminGetRestaurants(env);
      }

      if (path === "/api/admin/restaurants" && method === "POST") {
        return await adminCreateRestaurant(env, request);
      }

      if (
        path.startsWith("/api/admin/restaurants/") &&
        method === "PUT"
      ) {
        const id = Number(path.split("/").filter(Boolean)[3]);
        return await adminUpdateRestaurant(env, request, id);
      }

      if (
        path.startsWith("/api/admin/restaurants/") &&
        method === "DELETE"
      ) {
        const id = Number(path.split("/").filter(Boolean)[3]);
        return await adminDeleteRestaurant(env, id);
      }

      /* -----------------------------------------------------
         ADMIN CITIES
      ----------------------------------------------------- */

      if (path === "/api/admin/cities" && method === "GET") {
        return await adminGetCities(env);
      }

      if (path === "/api/admin/cities" && method === "POST") {
        return await adminCreateCity(env, request);
      }

      /* -----------------------------------------------------
         ADMIN RECIPES
      ----------------------------------------------------- */

      if (path === "/api/admin/recipes" && method === "GET") {
        return await adminGetRecipes(env);
      }

      if (path === "/api/admin/recipes" && method === "POST") {
        return await adminCreateRecipe(env, request);
      }

      if (
        path.startsWith("/api/admin/recipes/") &&
        method === "PUT"
      ) {
        const id = Number(path.split("/").filter(Boolean)[3]);
        return await adminUpdateRecipe(env, request, id);
      }

      if (
        path.startsWith("/api/admin/recipes/") &&
        method === "DELETE"
      ) {
        const id = Number(path.split("/").filter(Boolean)[3]);
        return await adminDeleteRecipe(env, id);
      }

      /* -----------------------------------------------------
         ADMIN STORIES
      ----------------------------------------------------- */

      if (path === "/api/admin/stories" && method === "GET") {
        return await adminGetStories(env);
      }

      if (path === "/api/admin/stories" && method === "POST") {
        return await adminCreateStory(env, request);
      }

      if (
        path.startsWith("/api/admin/stories/") &&
        method === "PUT"
      ) {
        const id = Number(path.split("/").filter(Boolean)[3]);
        return await adminUpdateStory(env, request, id);
      }

      if (
        path.startsWith("/api/admin/stories/") &&
        method === "DELETE"
      ) {
        const id = Number(path.split("/").filter(Boolean)[3]);
        return await adminDeleteStory(env, id);
      }

      /* -----------------------------------------------------
         PUBLIC CONTENT PAGES
      ----------------------------------------------------- */

      if (path.startsWith("/restaurant/") && method === "GET") {
        const slug = decodeURIComponent(
          path.replace("/restaurant/", "")
        );

        return await restaurantPage(env, slug);
      }

      if (path.startsWith("/recipe/") && method === "GET") {
        const slug = decodeURIComponent(
          path.replace("/recipe/", "")
        );

        return await recipePage(env, slug);
      }

      if (path.startsWith("/story/") && method === "GET") {
        const slug = decodeURIComponent(
          path.replace("/story/", "")
        );

        return await storyPage(env, slug);
      }

      /* -----------------------------------------------------
         HOMEPAGE
      ----------------------------------------------------- */

      if (path === "/" && method === "GET") {
        return await homePage(env, url);
      }

      return html(notFoundPage(), 404);
    } catch (error) {
      console.error("Worker error:", error);

      return json(
        {
          ok: false,
          error: "Internal server error"
        },
        500
      );
    }
  }
};


/* =========================================================
   RESPONSE HELPERS
   ========================================================= */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function html(content, status = 200) {
  return new Response(content, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}


/* =========================================================
   SECURITY
   ========================================================= */

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

async function hmacSign(secret, value) {
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

  return arrayBufferToBase64Url(signature);
}

async function createSession(env) {
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;

  const payload = String(expires);
  const signature = await hmacSign(
    env.ADMIN_SECRET,
    payload
  );

  return payload + "." + signature;
}

async function verifySession(env, token) {
  if (!token || !env.ADMIN_SECRET) {
    return false;
  }

  const dot = token.lastIndexOf(".");

  if (dot === -1) {
    return false;
  }

  const payload = token.substring(0, dot);
  const signature = token.substring(dot + 1);

  const expires = Number(payload);

  if (!Number.isFinite(expires)) {
    return false;
  }

  if (Date.now() > expires) {
    return false;
  }

  const expected = await hmacSign(
    env.ADMIN_SECRET,
    payload
  );

  return constantTimeEqual(signature, expected);
}

async function isAdminAuthenticated(request, env) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    return false;
  }

  const cookies = parseCookies(
    request.headers.get("Cookie") || ""
  );

  return await verifySession(
    env,
    cookies[SESSION_COOKIE]
  );
}

function parseCookies(header) {
  const result = {};

  header.split(";").forEach(function (part) {
    const index = part.indexOf("=");

    if (index === -1) {
      return;
    }

    const name = part.substring(0, index).trim();
    const value = part.substring(index + 1).trim();

    result[name] = decodeURIComponent(value);
  });

  return result;
}

function sameOrigin(request) {
  const origin = request.headers.get("Origin");

  if (!origin) {
    return true;
  }

  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);

    return (
      originUrl.protocol === requestUrl.protocol &&
      originUrl.host === requestUrl.host
    );
  } catch {
    return false;
  }
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

async function adminLogin(env, request) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    return json(
      {
        ok: false,
        error:
          "ADMIN_PASSWORD and ADMIN_SECRET must be configured in Cloudflare Worker Secrets."
      },
      500
    );
  }

  const body = await parseJson(request);

  const password =
    typeof body.password === "string"
      ? body.password
      : "";

  if (!constantTimeEqual(password, env.ADMIN_PASSWORD)) {
    return json(
      {
        ok: false,
        error: "Incorrect password"
      },
      401
    );
  }

  const session = await createSession(env);

  return new Response(
    JSON.stringify({
      ok: true
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie":
          SESSION_COOKIE +
          "=" +
          encodeURIComponent(session) +
          "; Max-Age=" +
          SESSION_HOURS * 60 * 60 +
          "; Path=/; HttpOnly; Secure; SameSite=Lax"
      }
    }
  );
}

async function adminLogout(env, request) {
  return new Response(
    JSON.stringify({
      ok: true
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie":
          SESSION_COOKIE +
          "=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax"
      }
    }
  );
}


/* =========================================================
   PUBLIC CITIES
   ========================================================= */

async function getCities(env) {
  const result = await env.DB.prepare(
    "SELECT id, name, country, slug FROM cities ORDER BY name"
  ).all();

  return json({
    ok: true,
    cities: result.results || []
  });
}


/* =========================================================
   PUBLIC RESTAURANTS
   ========================================================= */

async function getRestaurants(env, url) {
  const search = (url.searchParams.get("search") || "").trim();
  const city = (url.searchParams.get("city") || "").trim();
  const category = (url.searchParams.get("category") || "").trim();

  let sql =
    "SELECT r.id, r.name, r.slug, r.description, r.area, r.address, r.phone, r.website, r.cuisine, r.price_range, r.rating, r.review_count, r.featured, c.name AS city_name " +
    "FROM restaurants r " +
    "LEFT JOIN cities c ON c.id = r.city_id " +
    "WHERE r.status = 'published'";

  const params = [];

  if (search) {
    sql +=
      " AND (r.name LIKE ? OR r.description LIKE ? OR r.cuisine LIKE ? OR r.area LIKE ?)";

    const term = "%" + search + "%";

    params.push(term, term, term, term);
  }

  if (city) {
    sql += " AND c.slug = ?";
    params.push(city);
  }

  if (category) {
    sql +=
      " AND EXISTS (SELECT 1 FROM restaurant_categories rc WHERE rc.restaurant_id = r.id AND rc.category = ?)";
    params.push(category);
  }

  sql +=
    " ORDER BY r.featured DESC, r.rating DESC, r.name ASC";

  const result = await env.DB.prepare(sql)
    .bind(...params)
    .all();

  const restaurants = result.results || [];

  for (const restaurant of restaurants) {
    const categories = await env.DB.prepare(
      "SELECT category FROM restaurant_categories WHERE restaurant_id = ? ORDER BY category"
    )
      .bind(restaurant.id)
      .all();

    restaurant.categories = (categories.results || []).map(
      function (row) {
        return row.category;
      }
    );
  }

  return json({
    ok: true,
    restaurants
  });
}


/* =========================================================
   PUBLIC RECIPES
   ========================================================= */

async function getRecipes(env, url) {
  const search = (url.searchParams.get("search") || "").trim();
  const category = (url.searchParams.get("category") || "").trim();

  let sql =
    "SELECT id, title, slug, description, category, cuisine, prep_minutes, cook_minutes, servings, difficulty, rating, featured " +
    "FROM recipes WHERE status = 'published'";

  const params = [];

  if (search) {
    sql +=
      " AND (title LIKE ? OR description LIKE ? OR cuisine LIKE ? OR category LIKE ?)";

    const term = "%" + search + "%";

    params.push(term, term, term, term);
  }

  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }

  sql +=
    " ORDER BY featured DESC, rating DESC, title ASC";

  const result = await env.DB.prepare(sql)
    .bind(...params)
    .all();

  return json({
    ok: true,
    recipes: result.results || []
  });
}


/* =========================================================
   PUBLIC STORIES
   ========================================================= */

async function getStories(env, url) {
  const search = (url.searchParams.get("search") || "").trim();
  const category = (url.searchParams.get("category") || "").trim();

  let sql =
    "SELECT id, title, slug, excerpt, author_name, category, featured, created_at " +
    "FROM food_stories WHERE status = 'published'";

  const params = [];

  if (search) {
    sql +=
      " AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ?)";

    const term = "%" + search + "%";

    params.push(term, term, term);
  }

  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }

  sql +=
    " ORDER BY featured DESC, created_at DESC, title ASC";

  const result = await env.DB.prepare(sql)
    .bind(...params)
    .all();

  return json({
    ok: true,
    stories: result.results || []
  });
}


/* =========================================================
   PUBLIC REVIEW SUBMISSION
   ========================================================= */

async function submitReview(env, request, slug) {
  if (!slug) {
    return json(
      {
        ok: false,
        error: "Restaurant not found"
      },
      404
    );
  }

  const restaurant = await env.DB.prepare(
    "SELECT id FROM restaurants WHERE slug = ? AND status = 'published' LIMIT 1"
  )
    .bind(slug)
    .first();

  if (!restaurant) {
    return json(
      {
        ok: false,
        error: "Restaurant not found"
      },
      404
    );
  }

  const body = await parseJson(request);

  const authorName = cleanText(body.author_name);
  const authorEmail = cleanText(body.author_email);
  const title = cleanText(body.title);
  const reviewBody = cleanText(body.body);

  const overallRating = optionalRating(body.overall_rating);
  const foodRating = optionalRating(body.food_rating);
  const serviceRating = optionalRating(body.service_rating);
  const atmosphereRating = optionalRating(body.atmosphere_rating);
  const valueRating = optionalRating(body.value_rating);

  if (!authorName) {
    return json(
      {
        ok: false,
        error: "Name is required"
      },
      400
    );
  }

  if (!reviewBody) {
    return json(
      {
        ok: false,
        error: "Review is required"
      },
      400
    );
  }

  if (!overallRating) {
    return json(
      {
        ok: false,
        error: "Overall rating must be between 1 and 5"
      },
      400
    );
  }

  await env.DB.prepare(
    "INSERT INTO reviews (restaurant_id, author_name, author_email, title, body, overall_rating, food_rating, service_rating, atmosphere_rating, value_rating, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')"
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
    ok: true,
    message:
      "Thank you. Your review has been submitted for moderation."
  });
}


/* =========================================================
   ADMIN STATS
   ========================================================= */

async function adminStats(env) {
  const restaurants = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM restaurants"
  ).first();

  const recipes = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM recipes"
  ).first();

  const stories = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM food_stories"
  ).first();

  const pendingReviews = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM reviews WHERE status = 'pending'"
  ).first();

  const approvedReviews = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM reviews WHERE status = 'approved'"
  ).first();

  const cities = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM cities"
  ).first();

  return json({
    ok: true,
    stats: {
      restaurants: Number(restaurants?.count || 0),
      recipes: Number(recipes?.count || 0),
      stories: Number(stories?.count || 0),
      pending_reviews: Number(pendingReviews?.count || 0),
      approved_reviews: Number(approvedReviews?.count || 0),
      cities: Number(cities?.count || 0)
    }
  });
}


/* =========================================================
   ADMIN REVIEWS
   ========================================================= */

async function adminReviews(env, url) {
  const status =
    (url.searchParams.get("status") || "").trim();

  let sql =
    "SELECT rv.id, rv.restaurant_id, rv.author_name, rv.author_email, rv.title, rv.body, rv.overall_rating, rv.food_rating, rv.service_rating, rv.atmosphere_rating, rv.value_rating, rv.status, rv.created_at, r.name AS restaurant_name " +
    "FROM reviews rv " +
    "JOIN restaurants r ON r.id = rv.restaurant_id";

  const params = [];

  if (
    status === "pending" ||
    status === "approved" ||
    status === "rejected"
  ) {
    sql += " WHERE rv.status = ?";
    params.push(status);
  }

  sql += " ORDER BY rv.created_at DESC";

  const result = await env.DB.prepare(sql)
    .bind(...params)
    .all();

  return json({
    ok: true,
    reviews: result.results || []
  });
}


/* =========================================================
   REVIEW AGGREGATE CALCULATION
   ========================================================= */

async function recomputeRestaurantRating(
  env,
  restaurantId,
  oldRating,
  oldCount,
  approvedBeforeSum
) {
  const approvedAfter = await env.DB.prepare(
    "SELECT COUNT(*) AS count, COALESCE(SUM(overall_rating), 0) AS sum FROM reviews WHERE restaurant_id = ? AND status = 'approved'"
  )
    .bind(restaurantId)
    .first();

  const approvedAfterCount = Number(
    approvedAfter?.count || 0
  );

  const approvedAfterSum = Number(
    approvedAfter?.sum || 0
  );

  const legacyCount = Math.max(
    Number(oldCount || 0) -
      Number(
        await getApprovedCountBeforeChange(
          env,
          restaurantId,
          approvedBeforeSum
        )
      ),
    0
  );

  let legacySum =
    Number(oldRating || 0) * Number(oldCount || 0) -
    Number(approvedBeforeSum || 0);

  if (legacySum < 0) {
    legacySum = 0;
  }

  const totalCount =
    legacyCount + approvedAfterCount;

  const totalSum =
    legacySum + approvedAfterSum;

  const rating =
    totalCount > 0
      ? Math.round((totalSum / totalCount) * 10) / 10
      : 0;

  await env.DB.prepare(
    "UPDATE restaurants SET rating = ?, review_count = ? WHERE id = ?"
  )
    .bind(rating, totalCount, restaurantId)
    .run();

  return {
    rating,
    review_count: totalCount
  };
}

/*
  We need the count of approved reviews BEFORE the status
  change. Since the caller supplies the previous approved sum,
  this helper calculates the count independently.
*/
async function getApprovedCountBeforeChange(
  env,
  restaurantId,
  approvedBeforeSum
) {
  /*
    The review status has already changed by the time this
    function is called. For reliable seeded-rating behavior,
    callers below use a dedicated aggregate calculation
    instead.
  */
  const result = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM reviews WHERE restaurant_id = ? AND status = 'approved'"
  )
    .bind(restaurantId)
    .first();

  return Number(result?.count || 0);
}


/* =========================================================
   APPROVE REVIEW
   ========================================================= */

async function approveReview(env, reviewId) {
  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    return json(
      {
        ok: false,
        error: "Invalid review ID"
      },
      400
    );
  }

  const review = await env.DB.prepare(
    "SELECT id, restaurant_id, overall_rating, status FROM reviews WHERE id = ? LIMIT 1"
  )
    .bind(reviewId)
    .first();

  if (!review) {
    return json(
      {
        ok: false,
        error: "Review not found"
      },
      404
    );
  }

  if (review.status === "approved") {
    return json({
      ok: true,
      message: "Review is already approved"
    });
  }

  const restaurant = await env.DB.prepare(
    "SELECT id, rating, review_count FROM restaurants WHERE id = ? LIMIT 1"
  )
    .bind(review.restaurant_id)
    .first();

  if (!restaurant) {
    return json(
      {
        ok: false,
        error: "Restaurant not found"
      },
      404
    );
  }

  const before = await env.DB.prepare(
    "SELECT COUNT(*) AS count, COALESCE(SUM(overall_rating), 0) AS sum FROM reviews WHERE restaurant_id = ? AND status = 'approved'"
  )
    .bind(review.restaurant_id)
    .first();

  const approvedBeforeCount = Number(
    before?.count || 0
  );

  const approvedBeforeSum = Number(
    before?.sum || 0
  );

  await env.DB.prepare(
    "UPDATE reviews SET status = 'approved' WHERE id = ?"
  )
    .bind(reviewId)
    .run();

  const after = await env.DB.prepare(
    "SELECT COUNT(*) AS count, COALESCE(SUM(overall_rating), 0) AS sum FROM reviews WHERE restaurant_id = ? AND status = 'approved'"
  )
    .bind(review.restaurant_id)
    .first();

  const approvedAfterCount = Number(
    after?.count || 0
  );

  const approvedAfterSum = Number(
    after?.sum || 0
  );

  const oldCount = Number(
    restaurant.review_count || 0
  );

  const oldRating = Number(
    restaurant.rating || 0
  );

  const legacyCount = Math.max(
    oldCount - approvedBeforeCount,
    0
  );

  const legacySum = Math.max(
    oldRating * oldCount - approvedBeforeSum,
    0
  );

  const totalCount =
    legacyCount + approvedAfterCount;

  const totalSum =
    legacySum + approvedAfterSum;

  const rating =
    totalCount > 0
      ? Math.round((totalSum / totalCount) * 10) / 10
      : 0;

  await env.DB.prepare(
    "UPDATE restaurants SET rating = ?, review_count = ? WHERE id = ?"
  )
    .bind(
      rating,
      totalCount,
      review.restaurant_id
    )
    .run();

  return json({
    ok: true,
    rating,
    review_count: totalCount
  });
}


/* =========================================================
   REJECT REVIEW
   ========================================================= */

async function rejectReview(env, reviewId) {
  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    return json(
      {
        ok: false,
        error: "Invalid review ID"
      },
      400
    );
  }

  const review = await env.DB.prepare(
    "SELECT id, restaurant_id, overall_rating, status FROM reviews WHERE id = ? LIMIT 1"
  )
    .bind(reviewId)
    .first();

  if (!review) {
    return json(
      {
        ok: false,
        error: "Review not found"
      },
      404
    );
  }

  const restaurant = await env.DB.prepare(
    "SELECT id, rating, review_count FROM restaurants WHERE id = ? LIMIT 1"
  )
    .bind(review.restaurant_id)
    .first();

  if (!restaurant) {
    return json(
      {
        ok: false,
        error: "Restaurant not found"
      },
      404
    );
  }

  const before = await env.DB.prepare(
    "SELECT COUNT(*) AS count, COALESCE(SUM(overall_rating), 0) AS sum FROM reviews WHERE restaurant_id = ? AND status = 'approved'"
  )
    .bind(review.restaurant_id)
    .first();

  const approvedBeforeCount = Number(
    before?.count || 0
  );

  const approvedBeforeSum = Number(
    before?.sum || 0
  );

  await env.DB.prepare(
    "UPDATE reviews SET status = 'rejected' WHERE id = ?"
  )
    .bind(reviewId)
    .run();

  const after = await env.DB.prepare(
    "SELECT COUNT(*) AS count, COALESCE(SUM(overall_rating), 0) AS sum FROM reviews WHERE restaurant_id = ? AND status = 'approved'"
  )
    .bind(review.restaurant_id)
    .first();

  const approvedAfterCount = Number(
    after?.count || 0
  );

  const approvedAfterSum = Number(
    after?.sum || 0
  );

  const oldCount = Number(
    restaurant.review_count || 0
  );

  const oldRating = Number(
    restaurant.rating || 0
  );

  const legacyCount = Math.max(
    oldCount - approvedBeforeCount,
    0
  );

  const legacySum = Math.max(
    oldRating * oldCount - approvedBeforeSum,
    0
  );

  const totalCount =
    legacyCount + approvedAfterCount;

  const totalSum =
    legacySum + approvedAfterSum;

  const rating =
    totalCount > 0
      ? Math.round((totalSum / totalCount) * 10) / 10
      : 0;

  await env.DB.prepare(
    "UPDATE restaurants SET rating = ?, review_count = ? WHERE id = ?"
  )
    .bind(
      rating,
      totalCount,
      review.restaurant_id
    )
    .run();

  return json({
    ok: true,
    rating,
    review_count: totalCount
  });
}


/* =========================================================
   ADMIN RESTAURANTS
   ========================================================= */

async function adminGetRestaurants(env) {
  const result = await env.DB.prepare(
    "SELECT r.*, c.name AS city_name FROM restaurants r LEFT JOIN cities c ON c.id = r.city_id ORDER BY r.created_at DESC, r.name"
  ).all();

  const restaurants = result.results || [];

  for (const restaurant of restaurants) {
    const categories = await env.DB.prepare(
      "SELECT category FROM restaurant_categories WHERE restaurant_id = ? ORDER BY category"
    )
      .bind(restaurant.id)
      .all();

    restaurant.categories = (categories.results || []).map(
      function (row) {
        return row.category;
      }
    );
  }

  return json({
    ok: true,
    restaurants
  });
}

async function adminCreateRestaurant(env, request) {
  const body = await parseJson(request);

  const name = cleanText(body.name);

  if (!name) {
    return json(
      {
        ok: false,
        error: "Restaurant name is required"
      },
      400
    );
  }

  const slug = await makeUniqueSlug(
    env,
    "restaurants",
    body.slug || name
  );

  const description = cleanText(body.description);
  const cityId = nullableInteger(body.city_id);
  const area = cleanText(body.area);
  const address = cleanText(body.address);
  const phone = cleanText(body.phone);
  const website = safeUrl(body.website);
  const cuisine = cleanText(body.cuisine);
  const priceRange = cleanText(body.price_range);
  const rating = validRatingNumber(body.rating);
  const reviewCount = validNonNegativeInteger(
    body.review_count
  );
  const featured = body.featured ? 1 : 0;
  const status = validStatus(
    body.status,
    ["published", "draft"]
  ) || "published";

  await env.DB.prepare(
    "INSERT INTO restaurants (name, slug, description, city_id, area, address, phone, website, cuisine, price_range, rating, review_count, featured, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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

  const restaurant = await env.DB.prepare(
    "SELECT * FROM restaurants WHERE slug = ? LIMIT 1"
  )
    .bind(slug)
    .first();

  await saveRestaurantCategories(
    env,
    restaurant.id,
    body.categories
  );

  return json({
    ok: true,
    restaurant
  });
}

async function adminUpdateRestaurant(
  env,
  request,
  id
) {
  if (!Number.isInteger(id) || id <= 0) {
    return json(
      {
        ok: false,
        error: "Invalid restaurant ID"
      },
      400
    );
  }

  const existing = await env.DB.prepare(
    "SELECT * FROM restaurants WHERE id = ? LIMIT 1"
  )
    .bind(id)
    .first();

  if (!existing) {
    return json(
      {
        ok: false,
        error: "Restaurant not found"
      },
      404
    );
  }

  const body = await parseJson(request);

  const name =
    cleanText(body.name) || existing.name;

  const slug = await makeUniqueSlug(
    env,
    "restaurants",
    body.slug || name,
    id
  );

  const description =
    cleanText(body.description) ||
    existing.description ||
    null;

  const cityId =
    body.city_id === undefined
      ? existing.city_id
      : nullableInteger(body.city_id);

  const area =
    body.area === undefined
      ? existing.area
      : cleanText(body.area);

  const address =
    body.address === undefined
      ? existing.address
      : cleanText(body.address);

  const phone =
    body.phone === undefined
      ? existing.phone
      : cleanText(body.phone);

  const website =
    body.website === undefined
      ? existing.website
      : safeUrl(body.website);

  const cuisine =
    body.cuisine === undefined
      ? existing.cuisine
      : cleanText(body.cuisine);

  const priceRange =
    body.price_range === undefined
      ? existing.price_range
      : cleanText(body.price_range);

  const rating =
    body.rating === undefined
      ? Number(existing.rating || 0)
      : validRatingNumber(body.rating);

  const reviewCount =
    body.review_count === undefined
      ? Number(existing.review_count || 0)
      : validNonNegativeInteger(
          body.review_count
        );

  const featured =
    body.featured === undefined
      ? Number(existing.featured || 0)
      : body.featured
        ? 1
        : 0;

  const status =
    validStatus(
      body.status,
      ["published", "draft"]
    ) ||
    existing.status ||
    "published";

  await env.DB.prepare(
    "UPDATE restaurants SET name = ?, slug = ?, description = ?, city_id = ?, area = ?, address = ?, phone = ?, website = ?, cuisine = ?, price_range = ?, rating = ?, review_count = ?, featured = ?, status = ? WHERE id = ?"
  )
    .bind(
      name,
      slug,
      description,
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

  if (body.categories !== undefined) {
    await saveRestaurantCategories(
      env,
      id,
      body.categories
    );
  }

  const restaurant = await env.DB.prepare(
    "SELECT * FROM restaurants WHERE id = ? LIMIT 1"
  )
    .bind(id)
    .first();

  return json({
    ok: true,
    restaurant
  });
}

async function adminDeleteRestaurant(env, id) {
  if (!Number.isInteger(id) || id <= 0) {
    return json(
      {
        ok: false,
        error: "Invalid restaurant ID"
      },
      400
    );
  }

  await env.DB.prepare(
    "DELETE FROM restaurants WHERE id = ?"
  )
    .bind(id)
    .run();

  return json({
    ok: true
  });
}

async function saveRestaurantCategories(
  env,
  restaurantId,
  categories
) {
  await env.DB.prepare(
    "DELETE FROM restaurant_categories WHERE restaurant_id = ?"
  )
    .bind(restaurantId)
    .run();

  let list = [];

  if (Array.isArray(categories)) {
    list = categories;
  } else if (typeof categories === "string") {
    list = categories.split(",");
  }

  list = list
    .map(function (item) {
      return cleanText(item);
    })
    .filter(Boolean);

  for (const category of list) {
    await env.DB.prepare(
      "INSERT INTO restaurant_categories (restaurant_id, category) VALUES (?, ?)"
    )
      .bind(restaurantId, category)
      .run();
  }
}


/* =========================================================
   ADMIN CITIES
   ========================================================= */

async function adminGetCities(env) {
  const result = await env.DB.prepare(
    "SELECT * FROM cities ORDER BY name"
  ).all();

  return json({
    ok: true,
    cities: result.results || []
  });
}

async function adminCreateCity(env, request) {
  const body = await parseJson(request);

  const name = cleanText(body.name);

  if (!name) {
    return json(
      {
        ok: false,
        error: "City name is required"
      },
      400
    );
  }

  const slug = await makeUniqueSlug(
    env,
    "cities",
    body.slug || name
  );

  const country =
    cleanText(body.country) || "Pakistan";

  await env.DB.prepare(
    "INSERT INTO cities (name, country, slug) VALUES (?, ?, ?)"
  )
    .bind(name, country, slug)
    .run();

  const city = await env.DB.prepare(
    "SELECT * FROM cities WHERE slug = ? LIMIT 1"
  )
    .bind(slug)
    .first();

  return json({
    ok: true,
    city
  });
}


/* =========================================================
   ADMIN RECIPES
   ========================================================= */

async function adminGetRecipes(env) {
  const result = await env.DB.prepare(
    "SELECT * FROM recipes ORDER BY created_at DESC, title"
  ).all();

  const recipes = result.results || [];

  for (const recipe of recipes) {
    recipe.ingredients = await getRecipeIngredients(
      env,
      recipe.id
    );

    recipe.steps = await getRecipeSteps(
      env,
      recipe.id
    );
  }

  return json({
    ok: true,
    recipes
  });
}

async function adminCreateRecipe(env, request) {
  const body = await parseJson(request);

  const title = cleanText(body.title);

  if (!title) {
    return json(
      {
        ok: false,
        error: "Recipe title is required"
      },
      400
    );
  }

  const slug = await makeUniqueSlug(
    env,
    "recipes",
    body.slug || title
  );

  const description = cleanText(body.description);
  const category = cleanText(body.category);
  const cuisine = cleanText(body.cuisine);

  const prepMinutes = validNonNegativeInteger(
    body.prep_minutes
  );

  const cookMinutes = validNonNegativeInteger(
    body.cook_minutes
  );

  const servings =
    Math.max(
      validNonNegativeInteger(body.servings),
      1
    );

  const difficulty =
    cleanText(body.difficulty) || "Easy";

  const rating = validRatingNumber(body.rating);

  const featured = body.featured ? 1 : 0;

  const status =
    validStatus(
      body.status,
      ["published", "draft"]
    ) || "published";

  await env.DB.prepare(
    "INSERT INTO recipes (title, slug, description, category, cuisine, prep_minutes, cook_minutes, servings, difficulty, rating, featured, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      title,
      slug,
      description || null,
      category || null,
      cuisine || null,
      prepMinutes,
      cookMinutes,
      servings,
      difficulty,
      rating,
      featured,
      status
    )
    .run();

  const recipe = await env.DB.prepare(
    "SELECT * FROM recipes WHERE slug = ? LIMIT 1"
  )
    .bind(slug)
    .first();

  await saveRecipeIngredients(
    env,
    recipe.id,
    body.ingredients
  );

  await saveRecipeSteps(
    env,
    recipe.id,
    body.steps
  );

  return json({
    ok: true,
    recipe
  });
}

async function adminUpdateRecipe(
  env,
  request,
  id
) {
  if (!Number.isInteger(id) || id <= 0) {
    return json(
      {
        ok: false,
        error: "Invalid recipe ID"
      },
      400
    );
  }

  const existing = await env.DB.prepare(
    "SELECT * FROM recipes WHERE id = ? LIMIT 1"
  )
    .bind(id)
    .first();

  if (!existing) {
    return json(
      {
        ok: false,
        error: "Recipe not found"
      },
      404
    );
  }

  const body = await parseJson(request);

  const title =
    cleanText(body.title) || existing.title;

  const slug = await makeUniqueSlug(
    env,
    "recipes",
    body.slug || title,
    id
  );

  const description =
    body.description === undefined
      ? existing.description
      : cleanText(body.description);

  const category =
    body.category === undefined
      ? existing.category
      : cleanText(body.category);

  const cuisine =
    body.cuisine === undefined
      ? existing.cuisine
      : cleanText(body.cuisine);

  const prepMinutes =
    body.prep_minutes === undefined
      ? Number(existing.prep_minutes || 0)
      : validNonNegativeInteger(
          body.prep_minutes
        );

  const cookMinutes =
    body.cook_minutes === undefined
      ? Number(existing.cook_minutes || 0)
      : validNonNegativeInteger(
          body.cook_minutes
        );

  const servings =
    body.servings === undefined
      ? Number(existing.servings || 1)
      : Math.max(
          validNonNegativeInteger(body.servings),
          1
        );

  const difficulty =
    body.difficulty === undefined
      ? existing.difficulty || "Easy"
      : cleanText(body.difficulty) || "Easy";

  const rating =
    body.rating === undefined
      ? Number(existing.rating || 0)
      : validRatingNumber(body.rating);

  const featured =
    body.featured === undefined
      ? Number(existing.featured || 0)
      : body.featured
        ? 1
        : 0;

  const status =
    validStatus(
      body.status,
      ["published", "draft"]
    ) ||
    existing.status ||
    "published";

  await env.DB.prepare(
    "UPDATE recipes SET title = ?, slug = ?, description = ?, category = ?, cuisine = ?, prep_minutes = ?, cook_minutes = ?, servings = ?, difficulty = ?, rating = ?, featured = ?, status = ? WHERE id = ?"
  )
    .bind(
      title,
      slug,
      description || null,
      category || null,
      cuisine || null,
      prepMinutes,
      cookMinutes,
      servings,
      difficulty,
      rating,
      featured,
      status,
      id
    )
    .run();

  if (body.ingredients !== undefined) {
    await saveRecipeIngredients(
      env,
      id,
      body.ingredients
    );
  }

  if (body.steps !== undefined) {
    await saveRecipeSteps(
      env,
      id,
      body.steps
    );
  }

  const recipe = await env.DB.prepare(
    "SELECT * FROM recipes WHERE id = ? LIMIT 1"
  )
    .bind(id)
    .first();

  return json({
    ok: true,
    recipe
  });
}

async function adminDeleteRecipe(env, id) {
  if (!Number.isInteger(id) || id <= 0) {
    return json(
      {
        ok: false,
        error: "Invalid recipe ID"
      },
      400
    );
  }

  await env.DB.prepare(
    "DELETE FROM recipes WHERE id = ?"
  )
    .bind(id)
    .run();

  return json({
    ok: true
  });
}

async function getRecipeIngredients(
  env,
  recipeId
) {
  const result = await env.DB.prepare(
    "SELECT id, ingredient, quantity, sort_order FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order, id"
  )
    .bind(recipeId)
    .all();

  return result.results || [];
}

async function getRecipeSteps(env, recipeId) {
  const result = await env.DB.prepare(
    "SELECT id, step_number, instruction FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number, id"
  )
    .bind(recipeId)
    .all();

  return result.results || [];
}

async function saveRecipeIngredients(
  env,
  recipeId,
  ingredients
) {
  await env.DB.prepare(
    "DELETE FROM recipe_ingredients WHERE recipe_id = ?"
  )
    .bind(recipeId)
    .run();

  let list = [];

  if (Array.isArray(ingredients)) {
    list = ingredients;
  } else if (typeof ingredients === "string") {
    list = ingredients
      .split("\n")
      .map(function (line) {
        return {
          ingredient: line,
          quantity: ""
        };
      });
  }

  let order = 0;

  for (const item of list) {
    let ingredient = "";
    let quantity = "";

    if (typeof item === "string") {
      ingredient = cleanText(item);
    } else if (item && typeof item === "object") {
      ingredient = cleanText(item.ingredient);
      quantity = cleanText(item.quantity);
    }

    if (!ingredient) {
      continue;
    }

    await env.DB.prepare(
      "INSERT INTO recipe_ingredients (recipe_id, ingredient, quantity, sort_order) VALUES (?, ?, ?, ?)"
    )
      .bind(
        recipeId,
        ingredient,
        quantity || null,
        order
      )
      .run();

    order++;
  }
}

async function saveRecipeSteps(env, recipeId, steps) {
  await env.DB.prepare(
    "DELETE FROM recipe_steps WHERE recipe_id = ?"
  )
    .bind(recipeId)
    .run();

  let list = [];

  if (Array.isArray(steps)) {
    list = steps;
  } else if (typeof steps === "string") {
    list = steps.split("\n");
  }

  let number = 1;

  for (const item of list) {
    let instruction = "";

    if (typeof item === "string") {
      instruction = cleanText(item);
    } else if (item && typeof item === "object") {
      instruction = cleanText(item.instruction);
    }

    if (!instruction) {
      continue;
    }

    await env.DB.prepare(
      "INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)"
    )
      .bind(
        recipeId,
        number,
        instruction
      )
      .run();

    number++;
  }
}


/* =========================================================
   ADMIN STORIES
   ========================================================= */

async function adminGetStories(env) {
  const result = await env.DB.prepare(
    "SELECT * FROM food_stories ORDER BY created_at DESC, title"
  ).all();

  return json({
    ok: true,
    stories: result.results || []
  });
}

async function adminCreateStory(env, request) {
  const body = await parseJson(request);

  const title = cleanText(body.title);
  const content = cleanText(body.content);

  if (!title) {
    return json(
      {
        ok: false,
        error: "Story title is required"
      },
      400
    );
  }

  if (!content) {
    return json(
      {
        ok: false,
        error: "Story content is required"
      },
      400
    );
  }

  const slug = await makeUniqueSlug(
    env,
    "food_stories",
    body.slug || title
  );

  const excerpt =
    cleanText(body.excerpt) ||
    makeExcerpt(content, 180);

  const authorName =
    cleanText(body.author_name) ||
    "Tastify";

  const category = cleanText(body.category);

  const featured = body.featured ? 1 : 0;

  const status =
    validStatus(
      body.status,
      ["published", "draft"]
    ) || "published";

  await env.DB.prepare(
    "INSERT INTO food_stories (title, slug, excerpt, content, author_name, category, featured, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
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

  const story = await env.DB.prepare(
    "SELECT * FROM food_stories WHERE slug = ? LIMIT 1"
  )
    .bind(slug)
    .first();

  return json({
    ok: true,
    story
  });
}

async function adminUpdateStory(
  env,
  request,
  id
) {
  if (!Number.isInteger(id) || id <= 0) {
    return json(
      {
        ok: false,
        error: "Invalid story ID"
      },
      400
    );
  }

  const existing = await env.DB.prepare(
    "SELECT * FROM food_stories WHERE id = ? LIMIT 1"
  )
    .bind(id)
    .first();

  if (!existing) {
    return json(
      {
        ok: false,
        error: "Story not found"
      },
      404
    );
  }

  const body = await parseJson(request);

  const title =
    cleanText(body.title) || existing.title;

  const content =
    body.content === undefined
      ? existing.content
      : cleanText(body.content);

  const slug = await makeUniqueSlug(
    env,
    "food_stories",
    body.slug || title,
    id
  );

  const excerpt =
    body.excerpt === undefined
      ? existing.excerpt
      : cleanText(body.excerpt) ||
        makeExcerpt(content, 180);

  const authorName =
    body.author_name === undefined
      ? existing.author_name || "Tastify"
      : cleanText(body.author_name) ||
        "Tastify";

  const category =
    body.category === undefined
      ? existing.category
      : cleanText(body.category);

  const featured =
    body.featured === undefined
      ? Number(existing.featured || 0)
      : body.featured
        ? 1
        : 0;

  const status =
    validStatus(
      body.status,
      ["published", "draft"]
    ) ||
    existing.status ||
    "published";

  await env.DB.prepare(
    "UPDATE food_stories SET title = ?, slug = ?, excerpt = ?, content = ?, author_name = ?, category = ?, featured = ?, status = ? WHERE id = ?"
  )
    .bind(
      title,
      slug,
      excerpt || null,
      content,
      authorName,
      category || null,
      featured,
      status,
      id
    )
    .run();

  const story = await env.DB.prepare(
    "SELECT * FROM food_stories WHERE id = ? LIMIT 1"
  )
    .bind(id)
    .first();

  return json({
    ok: true,
    story
  });
}

async function adminDeleteStory(env, id) {
  if (!Number.isInteger(id) || id <= 0) {
    return json(
      {
        ok: false,
        error: "Invalid story ID"
      },
      400
    );
  }

  await env.DB.prepare(
    "DELETE FROM food_stories WHERE id = ?"
  )
    .bind(id)
    .run();

  return json({
    ok: true
  });
}


/* =========================================================
   PUBLIC RESTAURANT PAGE
   ========================================================= */

async function restaurantPage(env, slug) {
  const restaurant = await env.DB.prepare(
    "SELECT r.*, c.name AS city_name FROM restaurants r LEFT JOIN cities c ON c.id = r.city_id WHERE r.slug = ? AND r.status = 'published' LIMIT 1"
  )
    .bind(slug)
    .first();

  if (!restaurant) {
    return html(notFoundPage(), 404);
  }

  const categories = await env.DB.prepare(
    "SELECT category FROM restaurant_categories WHERE restaurant_id = ? ORDER BY category"
  )
    .bind(restaurant.id)
    .all();

  const reviews = await env.DB.prepare(
    "SELECT author_name, title, body, overall_rating, food_rating, service_rating, atmosphere_rating, value_rating, created_at FROM reviews WHERE restaurant_id = ? AND status = 'approved' ORDER BY created_at DESC"
  )
    .bind(restaurant.id)
    .all();

  const categoryList =
    (categories.results || [])
      .map(function (row) {
        return row.category;
      })
      .join(", ");

  const reviewHtml =
    (reviews.results || []).length > 0
      ? (reviews.results || [])
          .map(function (review) {
            return (
              '<article class="review-card">' +
              '<div class="review-top">' +
              "<strong>" +
              escapeHtml(review.author_name) +
              "</strong>" +
              "<span>" +
              escapeHtml(
                formatRating(review.overall_rating)
              ) +
              "</span>" +
              "</div>" +
              (review.title
                ? "<h4>" +
                  escapeHtml(review.title) +
                  "</h4>"
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

  const content =
    '<section class="detail-hero">' +
    '<a class="back-link" href="/">← Back to Tastify</a>' +
    '<div class="eyebrow">Restaurant Guide</div>' +
    "<h1>" +
    escapeHtml(restaurant.name) +
    "</h1>" +
    '<div class="rating-big">' +
    escapeHtml(formatRating(restaurant.rating)) +
    "</div>" +
    '<div class="muted">' +
    escapeHtml(
      String(restaurant.review_count || 0)
    ) +
    " reviews • " +
    escapeHtml(restaurant.city_name || "") +
    "</div>" +
    (categoryList
      ? '<p class="pill-line">' +
        escapeHtml(categoryList) +
        "</p>"
      : "") +
    "</section>" +

    '<section class="content-grid">' +
    '<div class="main-column">' +
    '<div class="card">' +
    "<h2>About</h2>" +
    "<p>" +
    escapeHtml(
      restaurant.description ||
        "Discover this restaurant with Tastify."
    ) +
    "</p>" +
    "</div>" +

    '<div class="card">' +
    "<h2>Reviews</h2>" +
    reviewHtml +
    "</div>" +

    '<div class="card">' +
    "<h2>Write a Review</h2>" +
    '<form id="reviewForm">' +

    '<label>Your name</label>' +
    '<input name="author_name" required>' +

    '<label>Email <span class="muted">(optional)</span></label>' +
    '<input name="author_email" type="email">' +

    '<label>Review title</label>' +
    '<input name="title">' +

    '<label>Your review</label>' +
    '<textarea name="body" rows="6" required></textarea>' +

    '<label>Overall rating</label>' +
    '<select name="overall_rating" required>' +
    '<option value="">Choose rating</option>' +
    '<option value="5">5 — Excellent</option>' +
    '<option value="4">4 — Very Good</option>' +
    '<option value="3">3 — Good</option>' +
    '<option value="2">2 — Fair</option>' +
    '<option value="1">1 — Poor</option>' +
    "</select>" +

    '<button class="button" type="submit">Submit Review</button>' +
    '<div id="reviewMessage"></div>' +
    "</form>" +
    "</div>" +
    "</div>" +

    '<aside class="side-column">' +
    '<div class="card">' +
    "<h3>Restaurant Details</h3>" +
    detailRow("Cuisine", restaurant.cuisine) +
    detailRow("Price", restaurant.price_range) +
    detailRow("Area", restaurant.area) +
    detailRow("Address", restaurant.address) +
    detailRow("Phone", restaurant.phone) +
    (restaurant.website
      ? '<p><a class="button secondary" target="_blank" rel="noopener" href="' +
        escapeAttribute(
          safeUrl(restaurant.website)
        ) +
        '">Visit Website</a></p>'
      : "") +
    "</div>" +
    "</aside>" +
    "</section>";

  const script =
    '<script>' +
    'document.getElementById("reviewForm").addEventListener("submit", async function(e){' +
    "e.preventDefault();" +
    'var form=e.currentTarget;' +
    'var message=document.getElementById("reviewMessage");' +
    'var data=Object.fromEntries(new FormData(form).entries());' +
    'data.overall_rating=Number(data.overall_rating);' +
    'message.textContent="Submitting...";' +
    'try{' +
    'var response=await fetch("/api/restaurants/' +
    encodeURIComponent(slug) +
    '/reviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});' +
    'var result=await response.json();' +
    'if(!response.ok||!result.ok){throw new Error(result.error||"Could not submit review");}' +
    'message.textContent=result.message||"Review submitted.";form.reset();' +
    '}catch(error){message.textContent=error.message;}' +
    "});" +
    "</script>";

  return html(
    pageShell(
      restaurant.name + " | Tastify",
      content,
      script
    )
  );
}


/* =========================================================
   PUBLIC RECIPE PAGE
   ========================================================= */

async function recipePage(env, slug) {
  const recipe = await env.DB.prepare(
    "SELECT * FROM recipes WHERE slug = ? AND status = 'published' LIMIT 1"
  )
    .bind(slug)
    .first();

  if (!recipe) {
    return html(notFoundPage(), 404);
  }

  const ingredients =
    await getRecipeIngredients(
      env,
      recipe.id
    );

  const steps =
    await getRecipeSteps(
      env,
      recipe.id
    );

  const ingredientsHtml =
    ingredients.length > 0
      ? "<ul>" +
        ingredients
          .map(function (item) {
            return (
              "<li>" +
              (item.quantity
                ? "<strong>" +
                  escapeHtml(item.quantity) +
                  "</strong> "
                : "") +
              escapeHtml(item.ingredient) +
              "</li>"
            );
          })
          .join("") +
        "</ul>"
      : '<div class="empty">Ingredients coming soon.</div>';

  const stepsHtml =
    steps.length > 0
      ? "<ol>" +
        steps
          .map(function (item) {
            return (
              "<li>" +
              escapeHtml(item.instruction) +
              "</li>"
            );
          })
          .join("") +
        "</ol>"
      : '<div class="empty">Recipe steps coming soon.</div>';

  const content =
    '<section class="detail-hero">' +
    '<a class="back-link" href="/">← Back to Tastify</a>' +
    '<div class="eyebrow">Tastify Recipe</div>' +
    "<h1>" +
    escapeHtml(recipe.title) +
    "</h1>" +
    (recipe.description
      ? "<p>" +
        escapeHtml(recipe.description) +
        "</p>"
      : "") +
    '<div class="recipe-meta">' +
    metaBox("Prep", recipe.prep_minutes + " min") +
    metaBox("Cook", recipe.cook_minutes + " min") +
    metaBox("Serves", recipe.servings) +
    metaBox("Difficulty", recipe.difficulty) +
    "</div>" +
    "</section>" +

    '<section class="content-grid">' +
    '<div class="main-column">' +
    '<div class="card">' +
    "<h2>Ingredients</h2>" +
    ingredientsHtml +
    "</div>" +

    '<div class="card">' +
    "<h2>Method</h2>" +
    stepsHtml +
    "</div>" +
    "</div>" +

    '<aside class="side-column">' +
    '<div class="card">' +
    detailRow("Cuisine", recipe.cuisine) +
    detailRow("Category", recipe.category) +
    detailRow(
      "Rating",
      formatRating(recipe.rating)
    ) +
    "</div>" +
    "</aside>" +
    "</section>";

  return html(
    pageShell(
      recipe.title + " | Tastify",
      content
    )
  );
}


/* =========================================================
   PUBLIC STORY PAGE
   ========================================================= */

async function storyPage(env, slug) {
  const story = await env.DB.prepare(
    "SELECT * FROM food_stories WHERE slug = ? AND status = 'published' LIMIT 1"
  )
    .bind(slug)
    .first();

  if (!story) {
    return html(notFoundPage(), 404);
  }

  const paragraphs =
    String(story.content || "")
      .split(/\n+/)
      .filter(Boolean)
      .map(function (paragraph) {
        return (
          "<p>" +
          escapeHtml(paragraph) +
          "</p>"
        );
      })
      .join("");

  const content =
    '<article class="story-page">' +
    '<a class="back-link" href="/">← Back to Tastify</a>' +
    '<div class="eyebrow">Food Story</div>' +
    "<h1>" +
    escapeHtml(story.title) +
    "</h1>" +
    (story.excerpt
      ? '<p class="lead">' +
        escapeHtml(story.excerpt) +
        "</p>"
      : "") +
    '<div class="story-meta">' +
    "By " +
    escapeHtml(story.author_name || "Tastify") +
    " • " +
    escapeHtml(formatDate(story.created_at)) +
    "</div>" +
    '<div class="story-content">' +
    paragraphs +
    "</div>" +
    "</article>";

  return html(
    pageShell(
      story.title + " | Tastify",
      content
    )
  );
}


/* =========================================================
   HOMEPAGE
   ========================================================= */

async function homePage(env, url) {
  const search =
    (url.searchParams.get("search") || "").trim();

  const city =
    (url.searchParams.get("city") || "").trim();

  const category =
    (url.searchParams.get("category") || "").trim();

  const citiesResult = await env.DB.prepare(
    "SELECT id, name, slug FROM cities ORDER BY name"
  ).all();

  const cities = citiesResult.results || [];

  let restaurantSql =
    "SELECT r.id, r.name, r.slug, r.description, r.area, r.cuisine, r.price_range, r.rating, r.review_count, r.featured, c.name AS city_name FROM restaurants r LEFT JOIN cities c ON c.id = r.city_id WHERE r.status = 'published'";

  const restaurantParams = [];

  if (search) {
    restaurantSql +=
      " AND (r.name LIKE ? OR r.description LIKE ? OR r.cuisine LIKE ? OR r.area LIKE ?)";

    const term = "%" + search + "%";

    restaurantParams.push(
      term,
      term,
      term,
      term
    );
  }

  if (city) {
    restaurantSql += " AND c.slug = ?";
    restaurantParams.push(city);
  }

  if (category) {
    restaurantSql +=
      " AND EXISTS (SELECT 1 FROM restaurant_categories rc WHERE rc.restaurant_id = r.id AND rc.category = ?)";

    restaurantParams.push(category);
  }

  restaurantSql +=
    " ORDER BY r.featured DESC, r.rating DESC, r.name LIMIT 12";

  const restaurantsResult =
    await env.DB.prepare(restaurantSql)
      .bind(...restaurantParams)
      .all();

  const restaurants =
    restaurantsResult.results || [];

  const recipesResult = await env.DB.prepare(
    "SELECT id, title, slug, description, category, cuisine, prep_minutes, cook_minutes, servings, difficulty, rating FROM recipes WHERE status = 'published' ORDER BY featured DESC, rating DESC, created_at DESC LIMIT 6"
  ).all();

  const recipes = recipesResult.results || [];

  const storiesResult = await env.DB.prepare(
    "SELECT id, title, slug, excerpt, author_name, category, created_at FROM food_stories WHERE status = 'published' ORDER BY featured DESC, created_at DESC LIMIT 4"
  ).all();

  const stories = storiesResult.results || [];

  const cityOptions =
    '<option value="">All cities</option>' +
    cities
      .map(function (item) {
        return (
          '<option value="' +
          escapeAttribute(item.slug) +
          '"' +
          (city === item.slug
            ? " selected"
            : "") +
          ">" +
          escapeHtml(item.name) +
          "</option>"
        );
      })
      .join("");

  const restaurantCards =
    restaurants.length > 0
      ? restaurants
          .map(function (restaurant) {
            return (
              '<a class="restaurant-card" href="/restaurant/' +
              encodeURIComponent(restaurant.slug) +
              '">' +
              '<div class="card-image restaurant-art">' +
              '<span>🍽️</span>' +
              "</div>" +
              '<div class="card-body">' +
              '<div class="eyebrow">' +
              escapeHtml(
                restaurant.cuisine ||
                  "Restaurant"
              ) +
              "</div>" +
              "<h3>" +
              escapeHtml(restaurant.name) +
              "</h3>" +
              '<div class="rating">' +
              "★ " +
              escapeHtml(
                formatRating(restaurant.rating)
              ) +
              " · " +
              escapeHtml(
                String(
                  restaurant.review_count || 0
                )
              ) +
              " reviews</div>" +
              '<p class="muted">' +
              escapeHtml(
                [
                  restaurant.area,
                  restaurant.city_name
                ]
                  .filter(Boolean)
                  .join(" • ")
              ) +
              "</p>" +
              "</div>" +
              "</a>"
            );
          })
          .join("")
      : '<div class="empty wide">No restaurants found yet.</div>';

  const recipeCards =
    recipes.length > 0
      ? recipes
          .map(function (recipe) {
            return (
              '<a class="recipe-card" href="/recipe/' +
              encodeURIComponent(recipe.slug) +
              '">' +
              '<div class="card-image recipe-art">' +
              "<span>🥘</span>" +
              "</div>" +
              '<div class="card-body">' +
              '<div class="eyebrow">' +
              escapeHtml(
                recipe.category ||
                  recipe.cuisine ||
                  "Recipe"
              ) +
              "</div>" +
              "<h3>" +
              escapeHtml(recipe.title) +
              "</h3>" +
              "<p>" +
              escapeHtml(
                recipe.description ||
                  "An easy Tastify recipe."
              ) +
              "</p>" +
              '<div class="muted">' +
              escapeHtml(
                String(recipe.prep_minutes || 0)
              ) +
              " min prep • " +
              escapeHtml(
                recipe.difficulty || "Easy"
              ) +
              "</div>" +
              "</div>" +
              "</a>"
            );
          })
          .join("")
      : '<div class="empty wide">No recipes added yet.</div>';

  const storyCards =
    stories.length > 0
      ? stories
          .map(function (story) {
            return (
              '<a class="story-card" href="/story/' +
              encodeURIComponent(story.slug) +
              '">' +
              '<div class="story-icon">✦</div>' +
              '<div class="card-body">' +
              '<div class="eyebrow">Food Story</div>' +
              "<h3>" +
              escapeHtml(story.title) +
              "</h3>" +
              "<p>" +
              escapeHtml(
                story.excerpt || ""
              ) +
              "</p>" +
              '<div class="muted">Read story →</div>' +
              "</div>" +
              "</a>"
            );
          })
          .join("")
      : '<div class="empty wide">No food stories added yet.</div>';

  const content =
    '<section class="hero">' +
    '<div class="hero-copy">' +
    '<div class="eyebrow">Discover With Tastify</div>' +
    "<h1>Where Food<br>Becomes an Experience.</h1>" +
    "<p>" +
    "Discover restaurants, cook easy recipes, and explore stories behind the food you love." +
    "</p>" +
    "</div>" +
    '<div class="hero-art">' +
    '<div class="hero-orb">✦</div>' +
    "</div>" +
    "</section>" +

    '<section class="search-panel">' +
    '<form method="GET" action="/">' +
    '<input name="search" value="' +
    escapeAttribute(search) +
    '" placeholder="Search restaurants, cuisines, recipes...">' +
    '<select name="city">' +
    cityOptions +
    "</select>" +
    '<input name="category" value="' +
    escapeAttribute(category) +
    '" placeholder="Cuisine or category">' +
    '<button class="button" type="submit">Discover</button>' +
    "</form>" +
    "</section>" +

    '<section class="section">' +
    '<div class="section-heading">' +
    "<div>" +
    '<div class="eyebrow">Explore</div>' +
    "<h2>Restaurants</h2>" +
    "</div>" +
    '<a href="/?view=restaurants">View all →</a>' +
    "</div>" +
    '<div class="card-grid">' +
    restaurantCards +
    "</div>" +
    "</section>" +

    '<section class="section alternate">' +
    '<div class="section-heading">' +
    "<div>" +
    '<div class="eyebrow">Cook Something</div>' +
    "<h2>Easy Recipes</h2>" +
    "</div>" +
    "</div>" +
    '<div class="card-grid">' +
    recipeCards +
    "</div>" +
    "</section>" +

    '<section class="section">' +
    '<div class="section-heading">' +
    "<div>" +
    '<div class="eyebrow">The Tastify Journal</div>' +
    "<h2>Food Stories</h2>" +
    "</div>" +
    "</div>" +
    '<div class="story-grid">' +
    storyCards +
    "</div>" +
    "</section>" +

    '<section class="manifesto">' +
    "<div>" +
    '<div class="eyebrow">Our Philosophy</div>' +
    "<h2>In the realms where food and art unite, we aspire to be magicians.</h2>" +
    "</div>" +
    "</section>";

  return html(
    pageShell(
      "Tastify — Discover With Tastify",
      content
    )
  );
}


/* =========================================================
   ADMIN LOGIN PAGE
   ========================================================= */

function loginPage() {
  return (
    '<!DOCTYPE html>' +
    '<html lang="en">' +
    "<head>" +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Tastify Admin Login</title>" +
    adminStyles() +
    "</head>" +
    "<body>" +
    '<main class="login-wrap">' +
    '<div class="login-card">' +
    '<div class="brand">Tastify<span>✦</span></div>' +
    '<div class="eyebrow">Administration</div>' +
    "<h1>Welcome Back</h1>" +
    "<p>Sign in to manage your Tastify content.</p>" +
    '<form id="loginForm">' +
    '<label>Admin Password</label>' +
    '<input type="password" name="password" required autofocus>' +
    '<button class="button" type="submit">Sign In</button>' +
    '<div id="loginMessage"></div>' +
    "</form>" +
    '<a class="back-link" href="/">← Back to Tastify</a>' +
    "</div>" +
    "</main>" +

    "<script>" +
    'document.getElementById("loginForm").addEventListener("submit",async function(e){' +
    "e.preventDefault();" +
    'var form=e.currentTarget;' +
    'var message=document.getElementById("loginMessage");' +
    'var password=form.elements.password.value;' +
    'message.textContent="Signing in...";' +
    'try{' +
    'var response=await fetch("/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:password})});' +
    'var data=await response.json();' +
    'if(!response.ok||!data.ok){throw new Error(data.error||"Login failed");}' +
    'window.location.href="/admin";' +
    '}catch(error){message.textContent=error.message;}' +
    "});" +
    "</script>" +

    "</body>" +
    "</html>"
  );
}


/* =========================================================
   ADMIN DASHBOARD
   ========================================================= */

function adminDashboard() {
  /*
    IMPORTANT:
    There are deliberately NO nested JavaScript template
    literals inside this page. This prevents the
    "Unexpected token '<'" build/runtime problem that
    occurred in the previous version.
  */

  const content =
    '<div class="admin-layout">' +

    '<aside class="admin-sidebar">' +
    '<div class="brand">Tastify<span>✦</span></div>' +
    '<div class="admin-label">ADMINISTRATION</div>' +

    '<button class="nav-btn active" data-section="dashboard">Dashboard</button>' +
    '<button class="nav-btn" data-section="restaurants">Restaurants</button>' +
    '<button class="nav-btn" data-section="recipes">Recipes</button>' +
    '<button class="nav-btn" data-section="stories">Food Stories</button>' +
    '<button class="nav-btn" data-section="reviews">Reviews</button>' +
    '<button class="nav-btn" data-section="cities">Cities</button>' +

    '<div class="sidebar-bottom">' +
    '<a href="/" target="_blank">View Website ↗</a>' +
    '<button id="logoutBtn">Log Out</button>' +
    "</div>" +
    "</aside>" +

    '<main class="admin-main">' +

    '<header class="admin-top">' +
    '<div>' +
    '<div class="eyebrow">Tastify Control Center</div>' +
    '<h1 id="pageTitle">Dashboard</h1>' +
    "</div>" +
    '<button class="mobile-menu" id="mobileMenu">☰</button>' +
    "</header>" +

    '<div id="adminMessage"></div>' +

    '<section id="section-dashboard" class="admin-section active">' +
    '<div class="stats-grid">' +
    statCard("restaurantsStat", "Restaurants", "🍽️") +
    statCard("recipesStat", "Recipes", "🥘") +
    statCard("storiesStat", "Stories", "📖") +
    statCard("pendingStat", "Pending Reviews", "★") +
    statCard("citiesStat", "Cities", "⌖") +
    "</div>" +

    '<div class="dashboard-grid">' +
    '<div class="panel">' +
    '<div class="panel-heading"><h2>Quick Actions</h2></div>' +
    '<div class="quick-actions">' +
    '<button class="action-card" data-action="restaurant">＋<strong>Add Restaurant</strong><span>Create a restaurant profile</span></button>' +
    '<button class="action-card" data-action="recipe">＋<strong>Add Recipe</strong><span>Add ingredients and method</span></button>' +
    '<button class="action-card" data-action="story">＋<strong>Add Food Story</strong><span>Publish a story</span></button>' +
    '<button class="action-card" data-action="city">＋<strong>Add City</strong><span>Add a destination</span></button>' +
    "</div>" +
    "</div>" +

    '<div class="panel">' +
    '<div class="panel-heading"><h2>Review Moderation</h2><button class="text-btn" data-section-link="reviews">Manage →</button></div>' +
    '<div id="dashboardReviews"></div>' +
    "</div>" +
    "</div>" +
    "</section>" +

    '<section id="section-restaurants" class="admin-section">' +
    sectionHeader(
      "Restaurants",
      "Add and manage restaurant listings.",
      "addRestaurantBtn"
    ) +
    '<div id="restaurantsTable" class="table-wrap"></div>' +
    "</section>" +

    '<section id="section-recipes" class="admin-section">' +
    sectionHeader(
      "Recipes",
      "Manage recipes, ingredients and cooking steps.",
      "addRecipeBtn"
    ) +
    '<div id="recipesTable" class="table-wrap"></div>' +
    "</section>" +

    '<section id="section-stories" class="admin-section">' +
    sectionHeader(
      "Food Stories",
      "Publish stories and food culture content.",
      "addStoryBtn"
    ) +
    '<div id="storiesTable" class="table-wrap"></div>' +
    "</section>" +

    '<section id="section-reviews" class="admin-section">' +
    '<div class="section-head"><div><h2>Review Moderation</h2><p>Approve or reject submitted reviews.</p></div></div>' +
    '<div class="filter-row">' +
    '<button class="filter-btn active" data-review-filter="pending">Pending</button>' +
    '<button class="filter-btn" data-review-filter="approved">Approved</button>' +
    '<button class="filter-btn" data-review-filter="rejected">Rejected</button>' +
    '<button class="filter-btn" data-review-filter="all">All</button>' +
    "</div>" +
    '<div id="reviewsTable" class="review-list"></div>' +
    "</section>" +

    '<section id="section-cities" class="admin-section">' +
    sectionHeader(
      "Cities",
      "Manage the cities available in your restaurant directory.",
      "addCityBtn"
    ) +
    '<div id="citiesTable" class="table-wrap"></div>' +
    "</section>" +

    "</main>" +
    "</div>" +

    '<div id="modal" class="modal hidden">' +
    '<div class="modal-backdrop"></div>' +
    '<div class="modal-card">' +
    '<button class="modal-close" id="modalClose">×</button>' +
    '<div id="modalContent"></div>' +
    "</div>" +
    "</div>";

  const script =
    "<script>" +

    "var state={" +
    'restaurants:[],' +
    'recipes:[],' +
    'stories:[],' +
    'cities:[],' +
    'reviews:[]' +
    "};" +

    "function showMessage(text,isError){" +
    'var el=document.getElementById("adminMessage");' +
    'el.textContent=text||"";' +
    'el.className=isError?"admin-error":"admin-success";' +
    'if(text){setTimeout(function(){el.textContent="";el.className="";},3500);}' +
    "}" +

    "async function api(url,options){" +
    "options=options||{};" +
    'var response=await fetch(url,options);' +
    'var text=await response.text();' +
    "var data;" +
    "try{data=JSON.parse(text);}catch(error){" +
    'throw new Error("Server returned an unexpected response.");' +
    "}" +
    'if(!response.ok||!data.ok){throw new Error(data.error||"Request failed");}' +
    "return data;" +
    "}" +

    "function switchSection(section){" +
    'document.querySelectorAll(".admin-section").forEach(function(el){el.classList.remove("active");});' +
    'var target=document.getElementById("section-"+section);' +
    "if(target){target.classList.add(\"active\");}" +
    'document.querySelectorAll(".nav-btn").forEach(function(btn){btn.classList.toggle("active",btn.getAttribute("data-section")===section);});' +
    'var titles={dashboard:"Dashboard",restaurants:"Restaurants",recipes:"Recipes",stories:"Food Stories",reviews:"Reviews",cities:"Cities"};' +
    'document.getElementById("pageTitle").textContent=titles[section]||"Dashboard";' +
    "if(section==='restaurants'){loadRestaurants();}" +
    "if(section==='recipes'){loadRecipes();}" +
    "if(section==='stories'){loadStories();}" +
    "if(section==='reviews'){loadReviews('pending');}" +
    "if(section==='cities'){loadCities();}" +
    "}" +

    'document.querySelectorAll(".nav-btn").forEach(function(btn){btn.addEventListener("click",function(){switchSection(btn.getAttribute("data-section"));});});' +

    'document.querySelectorAll("[data-section-link]").forEach(function(btn){btn.addEventListener("click",function(){switchSection(btn.getAttribute("data-section-link"));});});' +

    'document.querySelectorAll("[data-action]").forEach(function(btn){btn.addEventListener("click",function(){var action=btn.getAttribute("data-action");if(action==="restaurant"){openRestaurantForm();}if(action==="recipe"){openRecipeForm();}if(action==="story"){openStoryForm();}if(action==="city"){openCityForm();}});});' +

    'document.getElementById("addRestaurantBtn").addEventListener("click",openRestaurantForm);' +
    'document.getElementById("addRecipeBtn").addEventListener("click",openRecipeForm);' +
    'document.getElementById("addStoryBtn").addEventListener("click",openStoryForm);' +
    'document.getElementById("addCityBtn").addEventListener("click",openCityForm);' +

    'document.getElementById("modalClose").addEventListener("click",closeModal);' +
    'document.querySelector(".modal-backdrop").addEventListener("click",closeModal);' +

    'document.getElementById("logoutBtn").addEventListener("click",async function(){try{await api("/admin/logout",{method:"POST"});window.location.href="/admin";}catch(error){showMessage(error.message,true);}});' +

    'document.getElementById("mobileMenu").addEventListener("click",function(){document.querySelector(".admin-sidebar").classList.toggle("open");});' +

    'document.querySelectorAll("[data-review-filter]").forEach(function(btn){btn.addEventListener("click",function(){document.querySelectorAll("[data-review-filter]").forEach(function(b){b.classList.remove("active");});btn.classList.add("active");loadReviews(btn.getAttribute("data-review-filter"));});});' +

    "function openModal(content){" +
    'document.getElementById("modalContent").innerHTML=content;' +
    'document.getElementById("modal").classList.remove("hidden");' +
    "}" +

    "function closeModal(){" +
    'document.getElementById("modal").classList.add("hidden");' +
    'document.getElementById("modalContent").innerHTML="";' +
    "}" +

    "async function loadDashboard(){" +
    "try{" +
    'var data=await api("/api/admin/stats");' +
    'document.getElementById("restaurantsStat").textContent=data.stats.restaurants;' +
    'document.getElementById("recipesStat").textContent=data.stats.recipes;' +
    'document.getElementById("storiesStat").textContent=data.stats.stories;' +
    'document.getElementById("pendingStat").textContent=data.stats.pending_reviews;' +
    'document.getElementById("citiesStat").textContent=data.stats.cities;' +
    "await loadDashboardReviews();" +
    "}catch(error){showMessage(error.message,true);}" +
    "}" +

    "async function loadDashboardReviews(){" +
    "try{" +
    'var data=await api("/api/admin/reviews?status=pending");' +
    'var reviews=data.reviews.slice(0,5);' +
    'var el=document.getElementById("dashboardReviews");' +
    "if(!reviews.length){el.innerHTML='<div class=\"empty\">No pending reviews.</div>';return;}" +
    'el.innerHTML=reviews.map(function(review){return "<div class=\\"mini-review\\"><strong>"+esc(review.author_name)+"</strong><span>"+esc(review.restaurant_name)+"</span><span>"+stars(review.overall_rating)+"</span></div>";}).join("");' +
    "}catch(error){document.getElementById("dashboardReviews").innerHTML='<div class="empty">Unable to load reviews.</div>';}" +
    "}" +

    "async function loadRestaurants(){" +
    "try{" +
    'var data=await api("/api/admin/restaurants");' +
    'state.restaurants=data.restaurants;' +
    'renderRestaurants();' +
    "}catch(error){showMessage(error.message,true);}" +
    "}" +

    "function renderRestaurants(){" +
    'var el=document.getElementById("restaurantsTable");' +
    "if(!state.restaurants.length){el.innerHTML='<div class=\"empty wide\">No restaurants yet. Click Add Restaurant to create one.</div>';return;}" +
    'el.innerHTML="<table><thead><tr><th>Name</th><th>City</th><th>Cuisine</th><th>Rating</th><th>Status</th><th>Actions</th></tr></thead><tbody>"+state.restaurants.map(function(r){return "<tr><td><strong>"+esc(r.name)+"</strong><small>"+esc(r.slug)+"</small></td><td>"+esc(r.city_name||"—")+"</td><td>"+esc(r.cuisine||"—")+"</td><td>★ "+esc(r.rating)+"</td><td><span class=\\"status\\">"+esc(r.status)+"</span></td><td><button class=\\"small-btn\\" onclick=\\"editRestaurant("+r.id+")\\">Edit</button> <button class=\\"small-btn danger\\" onclick=\\"deleteRestaurant("+r.id+")\\">Delete</button></td></tr>";}).join("")+"</tbody></table>";' +
    "}" +

    "window.editRestaurant=function(id){var r=state.restaurants.find(function(x){return x.id===id;});if(r){openRestaurantForm(r);}};" +

    "window.deleteRestaurant=async function(id){" +
    'if(!confirm("Delete this restaurant? This will also remove its reviews and categories.")){return;}' +
    "try{await api('/api/admin/restaurants/'+id,{method:'DELETE'});showMessage('Restaurant deleted.');loadRestaurants();loadDashboard();}catch(error){showMessage(error.message,true);}" +
    "};" +

    "async function loadCities(){" +
    "try{" +
    'var data=await api("/api/admin/cities");' +
    'state.cities=data.cities;' +
    'renderCities();' +
    "}catch(error){showMessage(error.message,true);}" +
    "}" +

    "function renderCities(){" +
    'var el=document.getElementById("citiesTable");' +
    "if(!state.cities.length){el.innerHTML='<div class=\"empty wide\">No cities yet.</div>';return;}" +
    'el.innerHTML="<table><thead><tr><th>City</th><th>Country</th><th>Slug</th></tr></thead><tbody>"+state.cities.map(function(c){return "<tr><td><strong>"+esc(c.name)+"</strong></td><td>"+esc(c.country)+"</td><td>"+esc(c.slug)+"</td></tr>";}).join("")+"</tbody></table>";' +
    "}" +

    "async function loadRecipes(){" +
    "try{" +
    'var data=await api("/api/admin/recipes");' +
    'state.recipes=data.recipes;' +
    'renderRecipes();' +
    "}catch(error){showMessage(error.message,true);}" +
    "}" +

    "function renderRecipes(){" +
    'var el=document.getElementById("recipesTable");' +
    "if(!state.recipes.length){el.innerHTML='<div class=\"empty wide\">No recipes yet. Click Add Recipe to create one.</div>';return;}" +
    'el.innerHTML="<table><thead><tr><th>Recipe</th><th>Cuisine</th><th>Difficulty</th><th>Rating</th><th>Status</th><th>Actions</th></tr></thead><tbody>"+state.recipes.map(function(r){return "<tr><td><strong>"+esc(r.title)+"</strong><small>"+esc(r.slug)+"</small></td><td>"+esc(r.cuisine||"—")+"</td><td>"+esc(r.difficulty||"Easy")+"</td><td>★ "+esc(r.rating)+"</td><td><span class=\\"status\\">"+esc(r.status)+"</span></td><td><button class=\\"small-btn\\" onclick=\\"editRecipe("+r.id+")\\">Edit</button> <button class=\\"small-btn danger\\" onclick=\\"deleteRecipe("+r.id+")\\">Delete</button></td></tr>";}).join("")+"</tbody></table>";' +
    "}" +

    "window.editRecipe=function(id){var r=state.recipes.find(function(x){return x.id===id;});if(r){openRecipeForm(r);}};" +

    "window.deleteRecipe=async function(id){" +
    'if(!confirm("Delete this recipe?")){return;}' +
    "try{await api('/api/admin/recipes/'+id,{method:'DELETE'});showMessage('Recipe deleted.');loadRecipes();loadDashboard();}catch(error){showMessage(error.message,true);}" +
    "};" +

    "async function loadStories(){" +
    "try{" +
    'var data=await api("/api/admin/stories");' +
    'state.stories=data.stories;' +
    'renderStories();' +
    "}catch(error){showMessage(error.message,true);}" +
    "}" +

    "function renderStories(){" +
    'var el=document.getElementById("storiesTable");' +
    "if(!state.stories.length){el.innerHTML='<div class=\"empty wide\">No food stories yet. Click Add Food Story.</div>';return;}" +
    'el.innerHTML="<table><thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody>"+state.stories.map(function(s){return "<tr><td><strong>"+esc(s.title)+"</strong><small>"+esc(s.slug)+"</small></td><td>"+esc(s.author_name||"Tastify")+"</td><td>"+esc(s.category||"—")+"</td><td><span class=\\"status\\">"+esc(s.status)+"</span></td><td><button class=\\"small-btn\\" onclick=\\"editStory("+s.id+")\\">Edit</button> <button class=\\"small-btn danger\\" onclick=\\"deleteStory("+s.id+")\\">Delete</button></td></tr>";}).join("")+"</tbody></table>";' +
    "}" +

    "window.editStory=function(id){var s=state.stories.find(function(x){return x.id===id;});if(s){openStoryForm(s);}};" +

    "window.deleteStory=async function(id){" +
    'if(!confirm("Delete this story?")){return;}' +
    "try{await api('/api/admin/stories/'+id,{method:'DELETE'});showMessage('Story deleted.');loadStories();loadDashboard();}catch(error){showMessage(error.message,true);}" +
    "};" +

    "async function loadReviews(status){" +
    "try{" +
    'var url="/api/admin/reviews";' +
    'if(status&&status!=="all"){url+="?status="+encodeURIComponent(status);}' +
    'var data=await api(url);' +
    'state.reviews=data.reviews;' +
    'renderReviews();' +
    "}catch(error){showMessage(error.message,true);}" +
    "}" +

    "function renderReviews(){" +
    'var el=document.getElementById("reviewsTable");' +
    "if(!state.reviews.length){el.innerHTML='<div class=\"empty wide\">No reviews found.</div>';return;}" +
    'el.innerHTML=state.reviews.map(function(r){return "<article class=\\"admin-review\\"><div class=\\"review-header\\"><div><strong>"+esc(r.author_name)+"</strong><span>"+esc(r.restaurant_name)+"</span></div><div class=\\"review-rating\\">"+stars(r.overall_rating)+"</div></div>"+(r.title?"<h3>"+esc(r.title)+"</h3>":"")+"<p>"+esc(r.body)+"</p><div class=\\"review-footer\\"><span class=\\"status\\">"+esc(r.status)+"</span><small>"+esc(formatDate(r.created_at))+"</small><div>"+(r.status!=="approved"?'<button class="small-btn success" onclick="approveReview('+r.id+')">Approve</button>':"")+(r.status!=="rejected"?'<button class="small-btn danger" onclick="rejectReview('+r.id+')">Reject</button>':"")+"</div></div></article>";}).join("");' +
    "}" +

    "window.approveReview=async function(id){" +
    "try{await api('/api/admin/reviews/'+id+'/approve',{method:'POST'});showMessage('Review approved.');loadReviews('pending');loadDashboard();}catch(error){showMessage(error.message,true);}" +
    "};" +

    "window.rejectReview=async function(id){" +
    "try{await api('/api/admin/reviews/'+id+'/reject',{method:'POST'});showMessage('Review rejected.');loadReviews('pending');loadDashboard();}catch(error){showMessage(error.message,true);}" +
    "};" +

    "function openRestaurantForm(item){" +
    "item=item||{};" +
    'var editing=Boolean(item.id);' +
    'var cityOptions="<option value=\\"\\">Select city</option>"+state.cities.map(function(c){return "<option value=\\""+c.id+"\\""+(Number(item.city_id)===Number(c.id)?" selected":"")+">"+esc(c.name)+"</option>";}).join("");' +
    'var categories=Array.isArray(item.categories)?item.categories.join(", "):"";' +
    'openModal("<div class=\\"modal-heading\\"><div class=\\"eyebrow\\">Restaurant</div><h2>"+(editing?"Edit Restaurant":"Add Restaurant")+"</h2></div><form id=\\"restaurantForm\\"><div class=\\"form-grid\\"><label>Name<input name=\\"name\\" required value=\\""+attr(item.name||"")+"\\"></label><label>Slug<input name=\\"slug\\" value=\\""+attr(item.slug||"")+"\\"><small>Leave blank to generate automatically.</small></label><label>City<select name=\\"city_id\\">"+cityOptions+"</select></label><label>Area<input name=\\"area\\" value=\\""+attr(item.area||"")+"\\"></label><label>Address<input name=\\"address\\" value=\\""+attr(item.address||"")+"\\"></label><label>Phone<input name=\\"phone\\" value=\\""+attr(item.phone||"")+"\\"></label><label>Website<input name=\\"website\\" value=\\""+attr(item.website||"")+"\\"></label><label>Cuisine<input name=\\"cuisine\\" placeholder=\\"Italian, Burgers, Asian...\\" value=\\""+attr(item.cuisine||"")+"\\"></label><label>Price Range<input name=\\"price_range\\" placeholder=\\"$, $$, $$$\\" value=\\""+attr(item.price_range||"")+"\\"></label><label>Rating<input name=\\"rating\\" type=\\"number\\" min=\\"0\\" max=\\"5\\" step=\\"0.1\\" value=\\""+attr(item.rating||0)+"\\"></label><label>Review Count<input name=\\"review_count\\" type=\\"number\\" min=\\"0\\" value=\\""+attr(item.review_count||0)+"\\"></label><label>Categories<input name=\\"categories\\" placeholder=\\"Pizza, Pasta, Italian\\" value=\\""+attr(categories)+"\\"></label><label>Status<select name=\\"status\\"><option value=\\"published\\""+(item.status!=="draft"?" selected":"")+">Published</option><option value=\\"draft\\""+(item.status==="draft"?" selected":"")+">Draft</option></select></label></div><label>Description<textarea name=\\"description\\" rows=\\"5\\">"+esc(item.description||"")+"</textarea></label><label class=\\"check\\"><input type=\\"checkbox\\" name=\\"featured\\""+(item.featured?" checked":"")+"> Featured restaurant</label><button class=\\"button\\" type=\\"submit\\">"+(editing?"Save Changes":"Create Restaurant")+"</button></form>");' +
    'document.getElementById("restaurantForm").addEventListener("submit",async function(e){e.preventDefault();var f=e.currentTarget;var data=Object.fromEntries(new FormData(f).entries());data.city_id=data.city_id?Number(data.city_id):null;data.rating=Number(data.rating||0);data.review_count=Number(data.review_count||0);data.featured=f.elements.featured.checked;data.categories=data.categories.split(",").map(function(x){return x.trim();}).filter(Boolean);try{await api(editing?"/api/admin/restaurants/"+item.id:"/api/admin/restaurants",{method:editing?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});closeModal();showMessage(editing?"Restaurant updated.":"Restaurant created.");loadRestaurants();loadDashboard();}catch(error){showMessage(error.message,true);}});' +
    "if(!state.cities.length){loadCities();}" +
    "}" +

    "function openCityForm(){" +
    'openModal("<div class=\\"modal-heading\\"><div class=\\"eyebrow\\">Directory</div><h2>Add City</h2></div><form id=\\"cityForm\\"><label>City Name<input name=\\"name\\" required></label><label>Country<input name=\\"country\\" value=\\"Pakistan\\"></label><label>Slug<input name=\\"slug\\" placeholder=\\"Leave blank to generate\\"></label><button class=\\"button\\" type=\\"submit\\">Create City</button></form>");' +
    'document.getElementById("cityForm").addEventListener("submit",async function(e){e.preventDefault();var data=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api("/api/admin/cities",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});closeModal();showMessage("City created.");loadCities();loadDashboard();}catch(error){showMessage(error.message,true);}});' +
    "}" +

    "function openRecipeForm(item){" +
    "item=item||{};" +
    'var editing=Boolean(item.id);' +
    'var ingredients=Array.isArray(item.ingredients)?item.ingredients.map(function(x){return (x.quantity?x.quantity+" ":"")+x.ingredient;}).join("\\n"):"";' +
    'var steps=Array.isArray(item.steps)?item.steps.map(function(x){return x.instruction;}).join("\\n"):"";' +
    'openModal("<div class=\\"modal-heading\\"><div class=\\"eyebrow\\">Kitchen</div><h2>"+(editing?"Edit Recipe":"Add Recipe")+"</h2></div><form id=\\"recipeForm\\"><div class=\\"form-grid\\"><label>Title<input name=\\"title\\" required value=\\""+attr(item.title||"")+"\\"></label><label>Slug<input name=\\"slug\\" value=\\""+attr(item.slug||"")+"\\"></label><label>Category<input name=\\"category\\" value=\\""+attr(item.category||"")+"\\"></label><label>Cuisine<input name=\\"cuisine\\" value=\\""+attr(item.cuisine||"")+"\\"></label><label>Prep Minutes<input name=\\"prep_minutes\\" type=\\"number\\" min=\\"0\\" value=\\""+attr(item.prep_minutes||0)+"\\"></label><label>Cook Minutes<input name=\\"cook_minutes\\" type=\\"number\\" min=\\"0\\" value=\\""+attr(item.cook_minutes||0)+"\\"></label><label>Servings<input name=\\"servings\\" type=\\"number\\" min=\\"1\\" value=\\""+attr(item.servings||1)+"\\"></label><label>Difficulty<select name=\\"difficulty\\"><option"+(item.difficulty==="Easy"||!item.difficulty?" selected":"")+">Easy</option><option"+(item.difficulty==="Medium"?" selected":"")+">Medium</option><option"+(item.difficulty==="Hard"?" selected":"")+">Hard</option></select></label><label>Rating<input name=\\"rating\\" type=\\"number\\" min=\\"0\\" max=\\"5\\" step=\\"0.1\\" value=\\""+attr(item.rating||0)+"\\"></label><label>Status<select name=\\"status\\"><option value=\\"published\\""+(item.status!=="draft"?" selected":"")+">Published</option><option value=\\"draft\\""+(item.status==="draft"?" selected":"")+">Draft</option></select></label></div><label>Description<textarea name=\\"description\\" rows=\\"4\\">"+esc(item.description||"")+"</textarea></label><label>Ingredients <small>One ingredient per line. You can include quantity at the beginning.</small><textarea name=\\"ingredients\\" rows=\\"8\\" placeholder=\\"500 g chicken\\n1 onion\\n2 cloves garlic\\">"+esc(ingredients)+"</textarea></label><label>Method / Steps <small>One step per line.</small><textarea name=\\"steps\\" rows=\\"8\\" placeholder=\\"Prepare the ingredients.\\nCook until golden.\\nServe hot.\\">"+esc(steps)+"</textarea></label><label class=\\"check\\"><input type=\\"checkbox\\" name=\\"featured\\""+(item.featured?" checked":"")+"> Featured recipe</label><button class=\\"button\\" type=\\"submit\\">"+(editing?"Save Changes":"Create Recipe")+"</button></form>");' +
    'document.getElementById("recipeForm").addEventListener("submit",async function(e){e.preventDefault();var f=e.currentTarget;var data=Object.fromEntries(new FormData(f).entries());data.prep_minutes=Number(data.prep_minutes||0);data.cook_minutes=Number(data.cook_minutes||0);data.servings=Number(data.servings||1);data.rating=Number(data.rating||0);data.featured=f.elements.featured.checked;data.ingredients=data.ingredients.split("\\n").map(function(x){return x.trim();}).filter(Boolean);data.steps=data.steps.split("\\n").map(function(x){return x.trim();}).filter(Boolean);try{await api(editing?"/api/admin/recipes/"+item.id:"/api/admin/recipes",{method:editing?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});closeModal();showMessage(editing?"Recipe updated.":"Recipe created.");loadRecipes();loadDashboard();}catch(error){showMessage(error.message,true);}});' +
    "}" +

    "function openStoryForm(item){" +
    "item=item||{};" +
    'var editing=Boolean(item.id);' +
    'openModal("<div class=\\"modal-heading\\"><div class=\\"eyebrow\\">Journal</div><h2>"+(editing?"Edit Food Story":"Add Food Story")+"</h2></div><form id=\\"storyForm\\"><label>Title<input name=\\"title\\" required value=\\""+attr(item.title||"")+"\\"></label><label>Slug<input name=\\"slug\\" value=\\""+attr(item.slug||"")+"\\"></label><div class=\\"form-grid\\"><label>Author<input name=\\"author_name\\" value=\\""+attr(item.author_name||"Tastify")+"\\"></label><label>Category<input name=\\"category\\" value=\\""+attr(item.category||"")+"\\"></label><label>Status<select name=\\"status\\"><option value=\\"published\\""+(item.status!=="draft"?" selected":"")+">Published</option><option value=\\"draft\\""+(item.status==="draft"?" selected":"")+">Draft</option></select></label></div><label>Excerpt<textarea name=\\"excerpt\\" rows=\\"3\\">"+esc(item.excerpt||"")+"</textarea></label><label>Content<textarea name=\\"content\\" rows=\\"14\\" required>"+esc(item.content||"")+"</textarea></label><label class=\\"check\\"><input type=\\"checkbox\\" name=\\"featured\\""+(item.featured?" checked":"")+"> Featured story</label><button class=\\"button\\" type=\\"submit\\">"+(editing?"Save Changes":"Publish Story")+"</button></form>");' +
    'document.getElementById("storyForm").addEventListener("submit",async function(e){e.preventDefault();var f=e.currentTarget;var data=Object.fromEntries(new FormData(f).entries());data.featured=f.elements.featured.checked;try{await api(editing?"/api/admin/stories/"+item.id:"/api/admin/stories",{method:editing?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});closeModal();showMessage(editing?"Story updated.":"Story created.");loadStories();loadDashboard();}catch(error){showMessage(error.message,true);}});' +
    "}" +

    "function esc(value){" +
    'return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\\x27/g,"&#039;");' +
    "}" +

    "function attr(value){return esc(value);}" +

    "function stars(value){return '★'.repeat(Math.max(0,Math.min(5,Number(value)||0)));}" +

    "function formatDate(value){if(!value){return '';}try{return new Date(value.replace(' ','T')+'Z').toLocaleDateString();}catch(error){return value;}}" +

    "loadDashboard();" +
    "loadCities();" +

    "</script>";

  return (
    "<!DOCTYPE html>" +
    '<html lang="en">' +
    "<head>" +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Tastify Admin</title>" +
    adminStyles() +
    "</head>" +
    "<body>" +
    content +
    script +
    "</body>" +
    "</html>"
  );
}


/* =========================================================
   ADMIN UI HELPERS
   ========================================================= */

function statCard(id, label, icon) {
  return (
    '<div class="stat-card">' +
    '<div class="stat-icon">' +
    icon +
    "</div>" +
    '<div class="stat-number" id="' +
    id +
    '">0</div>' +
    '<div class="stat-label">' +
    escapeHtml(label) +
    "</div>" +
    "</div>"
  );
}

function sectionHeader(
  title,
  description,
  buttonId
) {
  return (
    '<div class="section-head">' +
    "<div>" +
    "<h2>" +
    escapeHtml(title) +
    "</h2>" +
    "<p>" +
    escapeHtml(description) +
    "</p>" +
    "</div>" +
    '<button class="button" id="' +
    buttonId +
    '">＋ Add</button>' +
    "</div>"
  );
}


/* =========================================================
   GLOBAL PAGE SHELL
   ========================================================= */

function pageShell(title, content, extraScript) {
  return (
    "<!DOCTYPE html>" +
    '<html lang="en">' +
    "<head>" +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" +
    escapeHtml(title) +
    "</title>" +
    publicStyles() +
    "</head>" +
    "<body>" +
    '<nav class="site-nav">' +
    '<a class="brand" href="/">Tastify<span>✦</span></a>' +
    '<div class="nav-links">' +
    '<a href="/">Home</a>' +
    '<a href="/?view=restaurants">Restaurants</a>' +
    '<a href="/?view=recipes">Recipes</a>' +
    '<a href="/?view=stories">Stories</a>' +
    '<a href="/admin">Admin</a>' +
    "</div>" +
    "</nav>" +
    '<main class="site-main">' +
    content +
    "</main>" +
    '<footer class="site-footer">' +
    '<div class="brand">Tastify<span>✦</span></div>' +
    "<p>Discover With Tastify.</p>" +
    "</footer>" +
    (extraScript || "") +
    "</body>" +
    "</html>"
  );
}


/* =========================================================
   PUBLIC CSS
   ========================================================= */

function publicStyles() {
  return (
    "<style>" +
    ":root{--green:#087f6c;--deep:#075c50;--cream:#fffaf0;--gold:#d8a83e;--orange:#f28c28;--ink:#17231f;--muted:#68746f;--white:#fff;--line:#e6e0d4}" +
    "*{box-sizing:border-box}" +
    "html{scroll-behavior:smooth}" +
    "body{margin:0;background:var(--cream);color:var(--ink);font-family:Arial,sans-serif;line-height:1.6}" +
    "a{color:inherit;text-decoration:none}" +
    ".site-nav{height:76px;padding:0 5%;display:flex;align-items:center;justify-content:space-between;background:rgba(255,250,240,.96);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10}" +
    ".brand{font-family:Georgia,serif;font-size:28px;font-weight:bold;color:var(--deep)}" +
    ".brand span{color:var(--gold);font-size:18px;margin-left:5px}" +
    ".nav-links{display:flex;gap:25px;font-size:14px;font-weight:bold}" +
    ".nav-links a:hover{color:var(--green)}" +
    ".site-main{max-width:1250px;margin:auto;padding:0 5% 70px}" +
    ".hero{min-height:480px;display:grid;grid-template-columns:1.1fr .9fr;align-items:center;gap:40px}" +
    ".hero h1{font-family:Georgia,serif;font-size:clamp(44px,7vw,82px);line-height:1.02;margin:12px 0 25px;color:var(--deep)}" +
    ".hero p{font-size:20px;max-width:620px;color:var(--muted)}" +
    ".eyebrow{font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;color:var(--orange)}" +
    ".hero-art{height:390px;border-radius:50% 45% 55% 40%;background:linear-gradient(135deg,#075c50,#087f6c);display:flex;align-items:center;justify-content:center;box-shadow:20px 25px 0 rgba(216,168,62,.18)}" +
    ".hero-orb{width:180px;height:180px;border-radius:50%;background:var(--cream);color:var(--gold);display:flex;align-items:center;justify-content:center;font-size:75px;box-shadow:0 20px 60px rgba(0,0,0,.15)}" +
    ".search-panel{background:#fff;border:1px solid var(--line);padding:18px;border-radius:16px;box-shadow:0 10px 30px rgba(30,60,50,.06);margin-bottom:70px}" +
    ".search-panel form{display:grid;grid-template-columns:2fr 1fr 1.3fr auto;gap:10px}" +
    "input,select,textarea{width:100%;border:1px solid #d9d5ca;border-radius:9px;padding:13px 14px;background:#fff;font:inherit;color:var(--ink)}" +
    "textarea{resize:vertical}" +
    "label{display:block;font-weight:bold;margin:12px 0 6px}" +
    ".button{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:9px;background:var(--green);color:#fff;padding:13px 20px;font-weight:bold;cursor:pointer;font-size:14px}" +
    ".button:hover{background:var(--deep)}" +
    ".button.secondary{background:var(--cream);color:var(--deep);border:1px solid var(--line)}" +
    ".section{padding:30px 0 70px}" +
    ".section.alternate{border-top:1px solid var(--line);border-bottom:1px solid var(--line)}" +
    ".section-heading{display:flex;align-items:end;justify-content:space-between;margin-bottom:25px}" +
    ".section-heading h2,.card h2{font-family:Georgia,serif;font-size:38px;margin:5px 0 0;color:var(--deep)}" +
    ".card-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}" +
    ".restaurant-card,.recipe-card,.story-card{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:.2s;display:block}" +
    ".restaurant-card:hover,.recipe-card:hover,.story-card:hover{transform:translateY(-4px);box-shadow:0 15px 35px rgba(30,60,50,.1)}" +
    ".card-image{height:180px;display:flex;align-items:center;justify-content:center;font-size:65px}" +
    ".restaurant-art{background:#e6f0e9}" +
    ".recipe-art{background:#f7ead4}" +
    ".card-body{padding:20px}" +
    ".card-body h3{font-family:Georgia,serif;font-size:24px;color:var(--deep);margin:6px 0}" +
    ".card-body p{color:var(--muted)}" +
    ".rating{font-weight:bold;color:var(--gold)}" +
    ".muted{color:var(--muted);font-size:13px}" +
    ".story-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}" +
    ".story-card{display:grid;grid-template-columns:90px 1fr}" +
    ".story-icon{background:var(--deep);color:var(--gold);display:flex;align-items:center;justify-content:center;font-size:34px}" +
    ".manifesto{margin:40px 0;padding:70px 8%;background:var(--deep);color:#fff;border-radius:22px;text-align:center}" +
    ".manifesto h2{font-family:Georgia,serif;font-size:clamp(30px,5vw,54px);line-height:1.15;font-weight:normal;margin:15px auto;max-width:950px}" +
    ".detail-hero{padding:60px 0 40px}" +
    ".detail-hero h1,.story-page h1{font-family:Georgia,serif;font-size:clamp(42px,6vw,72px);line-height:1.05;color:var(--deep);margin:10px 0 15px}" +
    ".rating-big{font-size:28px;color:var(--gold);font-weight:bold}" +
    ".back-link{color:var(--green);font-weight:bold;font-size:14px}" +
    ".pill-line{color:var(--muted)}" +
    ".content-grid{display:grid;grid-template-columns:2fr 1fr;gap:25px}" +
    ".main-column,.side-column{display:flex;flex-direction:column;gap:25px}" +
    ".card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:25px}" +
    ".card h3{font-family:Georgia,serif;color:var(--deep);font-size:25px}" +
    ".review-card{padding:18px 0;border-bottom:1px solid var(--line)}" +
    ".review-card:last-child{border-bottom:0}" +
    ".review-top{display:flex;justify-content:space-between;color:var(--gold)}" +
    ".review-card h4{margin:5px 0}" +
    ".review-card p{color:var(--muted)}" +
    ".recipe-meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:25px}" +
    ".meta-box{background:#fff;border:1px solid var(--line);padding:14px 18px;border-radius:10px;min-width:100px}" +
    ".meta-box strong{display:block;color:var(--deep)}" +
    ".card li{margin:8px 0}" +
    ".card ol li{padding-left:8px;margin-bottom:14px}" +
    ".story-page{max-width:850px;margin:70px auto}" +
    ".story-page .lead{font-size:22px;color:var(--muted)}" +
    ".story-meta{color:var(--muted);font-size:13px;margin:20px 0 35px}" +
    ".story-content{font-size:18px;line-height:1.9}" +
    ".site-footer{padding:40px 5%;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;color:var(--muted)}" +
    ".empty{padding:20px;color:var(--muted);background:#faf8f2;border-radius:10px}.empty.wide{padding:40px;text-align:center}" +
    ".notice{padding:12px;background:#f7ead4;border-left:4px solid var(--orange);margin:15px 0}" +
    "@media(max-width:850px){.nav-links{gap:12px;font-size:12px}.hero{grid-template-columns:1fr}.hero-art{height:260px}.search-panel form{grid-template-columns:1fr}.card-grid{grid-template-columns:1fr 1fr}.content-grid{grid-template-columns:1fr}.story-grid{grid-template-columns:1fr}}" +
    "@media(max-width:550px){.site-nav{height:auto;min-height:65px;padding:12px 5%;align-items:flex-start}.nav-links{display:none}.hero h1{font-size:48px}.card-grid{grid-template-columns:1fr}.site-footer{display:block}.section-heading{align-items:start;gap:10px;flex-direction:column}}" +
    "</style>"
  );
}


/* =========================================================
   ADMIN CSS
   ========================================================= */

function adminStyles() {
  return (
    "<style>" +
    ":root{--green:#087f6c;--deep:#075c50;--cream:#fffaf0;--gold:#d8a83e;--orange:#f28c28;--ink:#17231f;--muted:#68746f;--white:#fff;--line:#e4e0d6;--danger:#b7473b;--success:#22765d}" +
    "*{box-sizing:border-box}" +
    "body{margin:0;background:#f5f3ed;color:var(--ink);font-family:Arial,sans-serif}" +
    "button,input,select,textarea{font:inherit}" +
    "button{cursor:pointer}" +
    ".brand{font-family:Georgia,serif;font-size:27px;font-weight:bold;color:var(--deep)}" +
    ".brand span{color:var(--gold);font-size:17px}" +
    ".eyebrow{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--orange);font-weight:bold}" +
    ".login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:25px;background:var(--cream)}" +
    ".login-card{width:min(430px,100%);background:#fff;border:1px solid var(--line);border-radius:18px;padding:40px;box-shadow:0 20px 60px rgba(0,0,0,.08)}" +
    ".login-card h1{font-family:Georgia,serif;color:var(--deep);font-size:40px;margin:8px 0}.login-card p{color:var(--muted);margin-bottom:30px}" +
    "label{display:block;font-weight:bold;margin:13px 0 6px}input,select,textarea{width:100%;padding:12px;border:1px solid #d7d3c9;border-radius:8px;background:#fff;color:var(--ink)}textarea{resize:vertical}" +
    ".button{border:0;background:var(--green);color:#fff;border-radius:8px;padding:12px 18px;font-weight:bold;margin-top:15px}.button:hover{background:var(--deep)}" +
    ".back-link{display:inline-block;color:var(--green);font-weight:bold;margin-top:20px;font-size:13px}" +
    ".admin-layout{display:flex;min-height:100vh}" +
    ".admin-sidebar{width:240px;background:var(--deep);color:#fff;padding:28px 18px;position:fixed;left:0;top:0;bottom:0;display:flex;flex-direction:column;z-index:20}" +
    ".admin-sidebar .brand{color:#fff;padding:0 12px 30px}.admin-sidebar .brand span{color:var(--gold)}" +
    ".admin-label{font-size:9px;letter-spacing:2px;color:#9dc9bd;padding:0 12px 10px}" +
    ".nav-btn{display:block;width:100%;text-align:left;background:transparent;border:0;color:#dbece7;padding:13px 12px;border-radius:8px;margin:2px 0;font-weight:bold}" +
    ".nav-btn:hover,.nav-btn.active{background:#0b7665;color:#fff}" +
    ".sidebar-bottom{margin-top:auto;border-top:1px solid rgba(255,255,255,.12);padding-top:15px}.sidebar-bottom a,.sidebar-bottom button{display:block;width:100%;text-align:left;color:#dbece7;background:transparent;border:0;padding:11px 12px}" +
    ".admin-main{margin-left:240px;flex:1;padding:35px 4%;min-width:0}" +
    ".admin-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:25px}.admin-top h1{font-family:Georgia,serif;color:var(--deep);font-size:40px;margin:5px 0}.mobile-menu{display:none}" +
    ".admin-section{display:none}.admin-section.active{display:block}" +
    ".stats-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:25px}" +
    ".stat-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px}.stat-icon{font-size:20px}.stat-number{font-size:32px;font-weight:bold;color:var(--deep);margin-top:7px}.stat-label{color:var(--muted);font-size:13px}" +
    ".dashboard-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:20px}" +
    ".panel{background:#fff;border:1px solid var(--line);border-radius:12px;padding:22px}.panel-heading{display:flex;align-items:center;justify-content:space-between}.panel-heading h2{font-family:Georgia,serif;color:var(--deep);margin:0}.text-btn{border:0;background:transparent;color:var(--green);font-weight:bold}" +
    ".quick-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.action-card{background:#faf8f2;border:1px solid var(--line);border-radius:10px;padding:18px;text-align:left;color:var(--deep)}.action-card:hover{border-color:var(--green)}.action-card strong,.action-card span{display:block}.action-card strong{margin:5px 0}.action-card span{font-size:12px;color:var(--muted)}" +
    ".section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}.section-head h2{font-family:Georgia,serif;color:var(--deep);font-size:32px;margin:0}.section-head p{color:var(--muted);margin:5px 0}" +
    ".table-wrap{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:auto}table{width:100%;border-collapse:collapse;min-width:750px}th,td{text-align:left;padding:14px;border-bottom:1px solid var(--line);font-size:13px}th{background:#faf8f2;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:1px}td small{display:block;color:var(--muted);margin-top:3px}" +
    ".small-btn{border:1px solid var(--line);background:#fff;padding:7px 10px;border-radius:6px;font-size:12px;font-weight:bold;color:var(--deep)}.small-btn:hover{border-color:var(--green)}.small-btn.danger{color:var(--danger)}.small-btn.success{color:var(--success)}" +
    ".status{display:inline-block;padding:4px 8px;border-radius:20px;background:#eef4f0;color:var(--green);font-size:10px;font-weight:bold;text-transform:uppercase}" +
    ".filter-row{display:flex;gap:7px;margin-bottom:15px;flex-wrap:wrap}.filter-btn{border:1px solid var(--line);background:#fff;padding:8px 13px;border-radius:20px;color:var(--muted);font-weight:bold;font-size:12px}.filter-btn.active{background:var(--deep);color:#fff;border-color:var(--deep)}" +
    ".admin-review{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:12px}.review-header{display:flex;justify-content:space-between;gap:15px}.review-header strong,.review-header span{display:block}.review-header span{color:var(--muted);font-size:12px}.review-rating{color:var(--gold);white-space:nowrap}.admin-review h3{margin:12px 0 4px}.admin-review p{color:var(--muted)}.review-footer{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.review-footer>div{margin-left:auto}.mini-review{display:grid;grid-template-columns:1fr auto;gap:3px 15px;border-bottom:1px solid var(--line);padding:13px 0}.mini-review:last-child{border-bottom:0}.mini-review span{color:var(--muted);font-size:12px}.mini-review span:last-child{color:var(--gold);grid-column:2;grid-row:1 / span 2}" +
    ".admin-success,.admin-error{padding:11px 14px;border-radius:8px;margin-bottom:15px}.admin-success{background:#e6f4ed;color:var(--success)}.admin-error{background:#fae9e6;color:var(--danger)}" +
    ".modal{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:20px}.modal.hidden{display:none}.modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55)}.modal-card{position:relative;background:#fff;width:min(850px,100%);max-height:92vh;overflow:auto;border-radius:14px;padding:30px;z-index:1}.modal-close{position:absolute;right:15px;top:10px;border:0;background:transparent;font-size:30px;color:var(--muted)}.modal-heading h2{font-family:Georgia,serif;color:var(--deep);font-size:34px;margin:5px 0 20px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 15px}.form-grid label{margin-top:5px}.check{display:flex;align-items:center;gap:8px}.check input{width:auto}" +
    ".empty{padding:25px;color:var(--muted);text-align:center}.empty.wide{padding:50px}" +
    "@media(max-width:1000px){.stats-grid{grid-template-columns:repeat(3,1fr)}.dashboard-grid{grid-template-columns:1fr}}" +
    "@media(max-width:750px){.admin-sidebar{transform:translateX(-100%);transition:.2s}.admin-sidebar.open{transform:translateX(0)}.admin-main{margin-left:0;padding:25px 18px}.mobile-menu{display:block;border:1px solid var(--line);background:#fff;border-radius:7px;padding:8px 12px}.stats-grid{grid-template-columns:1fr 1fr}.quick-actions{grid-template-columns:1fr}.form-grid{grid-template-columns:1fr}.section-head{align-items:flex-start;gap:15px;flex-direction:column}.admin-top h1{font-size:32px}}" +
    "@media(max-width:450px){.stats-grid{grid-template-columns:1fr}.admin-main{padding:20px 12px}}" +
    "</style>"
  );
}


/* =========================================================
   GENERIC HELPERS
   ========================================================= */

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function cleanText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function nullableInteger(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (!Number.isInteger(number)) {
    return null;
  }

  return number;
}

function validNonNegativeInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(number)
  );
}

function validRatingNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.round(
    Math.max(0, Math.min(5, number)) * 10
  ) / 10;
}

function optionalRating(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 1 ||
    number > 5
  ) {
    return null;
  }

  return Math.round(number);
}

function validStatus(value, allowed) {
  const status = cleanText(value);

  return allowed.indexOf(status) !== -1
    ? status
    : null;
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

async function makeUniqueSlug(
  env,
  table,
  candidate,
  excludeId
) {
  const allowedTables = [
    "restaurants",
    "recipes",
    "food_stories",
    "cities"
  ];

  if (allowedTables.indexOf(table) === -1) {
    throw new Error("Invalid table");
  }

  let base = slugify(candidate);

  if (!base) {
    base = "item";
  }

  let slug = base;
  let counter = 2;

  while (true) {
    let sql =
      "SELECT id FROM " +
      table +
      " WHERE slug = ?";

    const params = [slug];

    if (
      excludeId !== undefined &&
      excludeId !== null
    ) {
      sql += " AND id != ?";
      params.push(excludeId);
    }

    sql += " LIMIT 1";

    const existing = await env.DB.prepare(sql)
      .bind(...params)
      .first();

    if (!existing) {
      return slug;
    }

    slug =
      base +
      "-" +
      String(counter);

    counter++;
  }
}

function safeUrl(value) {
  const text = cleanText(value);

  if (!text) {
    return "";
  }

  try {
    const url =
      /^https?:\/\//i.test(text)
        ? new URL(text)
        : new URL("https://" + text);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(
    value === null || value === undefined
      ? ""
      : value
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function formatRating(value) {
  const number = Number(value || 0);

  return number > 0
    ? number.toFixed(1) + " ★"
    : "No rating";
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
    const date = new Date(
      String(value).replace(" ", "T") +
        "Z"
    );

    return date.toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "short",
        day: "numeric"
      }
    );
  } catch {
    return String(value);
  }
}

function makeExcerpt(text, length) {
  const value = cleanText(text);

  if (value.length <= length) {
    return value;
  }

  return value.substring(0, length).trim() + "…";
}

function detailRow(label, value) {
  if (!value) {
    return "";
  }

  return (
    '<div style="padding:10px 0;border-bottom:1px solid #e6e0d4">' +
    '<small style="display:block;color:#68746f">' +
    escapeHtml(label) +
    "</small>" +
    "<strong>" +
    escapeHtml(value) +
    "</strong>" +
    "</div>"
  );
}

function metaBox(label, value) {
  return (
    '<div class="meta-box">' +
    "<small>" +
    escapeHtml(label) +
    "</small>" +
    "<strong>" +
    escapeHtml(String(value)) +
    "</strong>" +
    "</div>"
  );
}

function notFoundPage() {
  return (
    '<div style="max-width:700px;margin:100px auto;text-align:center">' +
    '<div class="eyebrow">Tastify</div>' +
    '<h1 style="font-family:Georgia,serif;color:#075c50;font-size:60px">Page Not Found</h1>' +
    '<p style="color:#68746f">The page you are looking for does not exist.</p>' +
    '<a class="button" href="/">Return Home</a>' +
    "</div>"
  );
}
