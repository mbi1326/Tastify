export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {

      /* =========================================================
         PUBLIC API — RESTAURANTS
      ========================================================= */

      if (
        url.pathname === "/api/restaurants" &&
        request.method === "GET"
      ) {
        const city = url.searchParams.get("city");
        const category = url.searchParams.get("category");
        const search = url.searchParams.get("search");

        let query = `
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
            c.name AS city
          FROM restaurants r
          LEFT JOIN cities c ON r.city_id = c.id
          WHERE r.status = 'published'
        `;

        const params = [];

        if (city) {
          query += ` AND c.slug = ?`;
          params.push(city);
        }

        if (search) {
          query += `
            AND (
              r.name LIKE ?
              OR r.cuisine LIKE ?
              OR r.area LIKE ?
            )
          `;

          const term = `%${search}%`;
          params.push(term, term, term);
        }

        if (category) {
          query += `
            AND EXISTS (
              SELECT 1
              FROM restaurant_categories rc
              WHERE rc.restaurant_id = r.id
              AND rc.category = ?
            )
          `;

          params.push(category);
        }

        query += `
          ORDER BY
            r.featured DESC,
            r.rating DESC,
            r.name ASC
        `;

        const statement = env.DB.prepare(query);

        const { results } =
          await statement.bind(...params).all();

        return Response.json(results);
      }


      /* =========================================================
         PUBLIC API — CITIES
      ========================================================= */

      if (
        url.pathname === "/api/cities" &&
        request.method === "GET"
      ) {
        const { results } = await env.DB.prepare(`
          SELECT id, name, country, slug
          FROM cities
          ORDER BY name ASC
        `).all();

        return Response.json(results);
      }


      /* =========================================================
         PUBLIC API — RESTAURANT REVIEW SUBMISSION
      ========================================================= */

      if (
        url.pathname.startsWith("/api/restaurants/") &&
        url.pathname.endsWith("/reviews") &&
        request.method === "POST"
      ) {
        const slug = decodeURIComponent(
          url.pathname
            .replace("/api/restaurants/", "")
            .replace("/reviews", "")
        );

        const restaurant = await env.DB.prepare(`
          SELECT id
          FROM restaurants
          WHERE slug = ?
          AND status = 'published'
          LIMIT 1
        `)
          .bind(slug)
          .first();

        if (!restaurant) {
          return Response.json(
            { error: "Restaurant not found." },
            { status: 404 }
          );
        }

        let data;

        try {
          data = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid request." },
            { status: 400 }
          );
        }

        const author =
          String(data.author_name || "").trim();

        const email =
          String(data.author_email || "").trim();

        const title =
          String(data.title || "").trim();

        const body =
          String(data.body || "").trim();

        const overall =
          Number(data.overall_rating);

        const food =
          Number(data.food_rating);

        const service =
          Number(data.service_rating);

        const atmosphere =
          Number(data.atmosphere_rating);

        const value =
          Number(data.value_rating);

        if (!author || !body) {
          return Response.json(
            {
              error:
                "Name and review are required."
            },
            { status: 400 }
          );
        }

        if (
          !Number.isInteger(overall) ||
          overall < 1 ||
          overall > 5
        ) {
          return Response.json(
            {
              error:
                "Overall rating must be between 1 and 5."
            },
            { status: 400 }
          );
        }

        const ratings = [
          food,
          service,
          atmosphere,
          value
        ];

        if (
          ratings.some(
            r =>
              !Number.isInteger(r) ||
              r < 1 ||
              r > 5
          )
        ) {
          return Response.json(
            {
              error:
                "All ratings must be between 1 and 5."
            },
            { status: 400 }
          );
        }

        if (
          author.length > 80 ||
          body.length > 3000
        ) {
          return Response.json(
            {
              error:
                "Review is too long."
            },
            { status: 400 }
          );
        }

        await env.DB.prepare(`
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
        `)
          .bind(
            restaurant.id,
            author,
            email || null,
            title || null,
            body,
            overall,
            food,
            service,
            atmosphere,
            value
          )
          .run();

        return Response.json({
          success: true,
          message:
            "Thank you! Your review has been submitted and is awaiting moderation."
        });
      }


      /* =========================================================
         ADMIN LOGIN
      ========================================================= */

      if (
        url.pathname === "/admin/login" &&
        request.method === "POST"
      ) {
        let data;

        try {
          data = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid request." },
            { status: 400 }
          );
        }

        const password =
          String(data.password || "");

        if (
          !env.ADMIN_PASSWORD ||
          !env.ADMIN_SECRET
        ) {
          return Response.json(
            {
              error:
                "Admin authentication is not configured."
            },
            { status: 500 }
          );
        }

        if (
          !constantTimeEqual(
            password,
            env.ADMIN_PASSWORD
          )
        ) {
          return Response.json(
            {
              error:
                "Incorrect password."
            },
            { status: 401 }
          );
        }

        const expires =
          Math.floor(Date.now() / 1000) +
          60 * 60 * 12;

        const token =
          await createSession(
            env.ADMIN_SECRET,
            expires
          );

        return new Response(
          JSON.stringify({
            success: true
          }),
          {
            headers: {
              "content-type":
                "application/json",
              "set-cookie":
                `tastify_admin=${token}; ` +
                `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`
            }
          }
        );
      }


      /* =========================================================
         ADMIN LOGOUT
      ========================================================= */

      if (
        url.pathname === "/admin/logout" &&
        request.method === "POST"
      ) {
        return new Response(
          JSON.stringify({
            success: true
          }),
          {
            headers: {
              "content-type":
                "application/json",
              "set-cookie":
                "tastify_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
            }
          }
        );
      }


      /* =========================================================
         ADMIN DASHBOARD
      ========================================================= */

      if (
        url.pathname === "/admin" ||
        url.pathname === "/admin/"
      ) {
        const authenticated =
          await isAdmin(request, env);

        if (!authenticated) {
          return new Response(
            adminLoginPage(),
            {
              headers: {
                "content-type":
                  "text/html;charset=UTF-8",
                "cache-control":
                  "no-store"
              }
            }
          );
        }

        return new Response(
          await adminDashboard(env),
          {
            headers: {
              "content-type":
                "text/html;charset=UTF-8",
              "cache-control":
                "no-store"
            }
          }
        );
      }


      /* =========================================================
         ADMIN API — DASHBOARD STATS
      ========================================================= */

      if (
        url.pathname === "/api/admin/stats" &&
        request.method === "GET"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const pending =
          await env.DB.prepare(`
            SELECT COUNT(*) AS count
            FROM reviews
            WHERE status = 'pending'
          `).first();

        const restaurants =
          await env.DB.prepare(`
            SELECT COUNT(*) AS count
            FROM restaurants
          `).first();

        const recipes =
          await env.DB.prepare(`
            SELECT COUNT(*) AS count
            FROM recipes
          `).first();

        const stories =
          await env.DB.prepare(`
            SELECT COUNT(*) AS count
            FROM food_stories
          `).first();

        return Response.json({
          pending_reviews:
            Number(pending?.count || 0),

          restaurants:
            Number(restaurants?.count || 0),

          recipes:
            Number(recipes?.count || 0),

          food_stories:
            Number(stories?.count || 0)
        });
      }


      /* =========================================================
         ADMIN API — REVIEWS
      ========================================================= */

      if (
        url.pathname === "/api/admin/reviews" &&
        request.method === "GET"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const status =
          url.searchParams.get("status") ||
          "pending";

        const { results } =
          await env.DB.prepare(`
            SELECT
              rv.*,
              r.name AS restaurant_name,
              r.slug AS restaurant_slug
            FROM reviews rv
            JOIN restaurants r
              ON r.id = rv.restaurant_id
            WHERE rv.status = ?
            ORDER BY rv.created_at DESC
          `)
            .bind(status)
            .all();

        return Response.json(results);
      }


      /* =========================================================
         ADMIN API — APPROVE REVIEW
      ========================================================= */

      if (
        url.pathname.match(
          /^\/api\/admin\/reviews\/\d+\/approve$/
        ) &&
        request.method === "POST"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const reviewId =
          Number(
            url.pathname
              .split("/")
              .filter(Boolean)
              .at(-2)
          );

        const review =
          await env.DB.prepare(`
            SELECT
              id,
              restaurant_id,
              overall_rating,
              status
            FROM reviews
            WHERE id = ?
            LIMIT 1
          `)
            .bind(reviewId)
            .first();

        if (!review) {
          return Response.json(
            {
              error:
                "Review not found."
            },
            { status: 404 }
          );
        }

        await env.DB.prepare(`
          UPDATE reviews
          SET status = 'approved'
          WHERE id = ?
        `)
          .bind(reviewId)
          .run();

        await recalculateRestaurant(
          env,
          review.restaurant_id
        );

        return Response.json({
          success: true,
          message:
            "Review approved and restaurant rating updated."
        });
      }


      /* =========================================================
         ADMIN API — REJECT REVIEW
      ========================================================= */

      if (
        url.pathname.match(
          /^\/api\/admin\/reviews\/\d+\/reject$/
        ) &&
        request.method === "POST"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const reviewId =
          Number(
            url.pathname
              .split("/")
              .filter(Boolean)
              .at(-2)
          );

        const review =
          await env.DB.prepare(`
            SELECT restaurant_id
            FROM reviews
            WHERE id = ?
            LIMIT 1
          `)
            .bind(reviewId)
            .first();

        if (!review) {
          return Response.json(
            {
              error:
                "Review not found."
            },
            { status: 404 }
          );
        }

        await env.DB.prepare(`
          UPDATE reviews
          SET status = 'rejected'
          WHERE id = ?
        `)
          .bind(reviewId)
          .run();

        await recalculateRestaurant(
          env,
          review.restaurant_id
        );

        return Response.json({
          success: true,
          message:
            "Review rejected."
        });
      }


      /* =========================================================
         ADMIN API — RESTAURANTS
      ========================================================= */

      if (
        url.pathname === "/api/admin/restaurants" &&
        request.method === "GET"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const { results } =
          await env.DB.prepare(`
            SELECT
              r.*,
              c.name AS city
            FROM restaurants r
            LEFT JOIN cities c
              ON c.id = r.city_id
            ORDER BY r.created_at DESC
          `).all();

        return Response.json(results);
      }


      /* =========================================================
         ADMIN API — CREATE RESTAURANT
      ========================================================= */

      if (
        url.pathname === "/api/admin/restaurants" &&
        request.method === "POST"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const data =
          await safeJson(request);

        if (!data) {
          return Response.json(
            { error: "Invalid request." },
            { status: 400 }
          );
        }

        const name =
          String(data.name || "").trim();

        const slug =
          String(
            data.slug ||
            slugify(name)
          ).trim();

        if (!name || !slug) {
          return Response.json(
            {
              error:
                "Restaurant name is required."
            },
            { status: 400 }
          );
        }

        try {
          await env.DB.prepare(`
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
              featured,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .bind(
              name,
              slug,
              clean(data.description),
              numberOrNull(data.city_id),
              clean(data.area),
              clean(data.address),
              clean(data.phone),
              clean(data.website),
              clean(data.cuisine),
              clean(data.price_range) || "$$",
              data.featured ? 1 : 0,
              data.status || "published"
            )
            .run();
        } catch (error) {
          return Response.json(
            {
              error:
                "Could not create restaurant. The slug may already exist."
            },
            { status: 400 }
          );
        }

        return Response.json({
          success: true
        });
      }


      /* =========================================================
         ADMIN API — UPDATE RESTAURANT
      ========================================================= */

      if (
        url.pathname.match(
          /^\/api\/admin\/restaurants\/\d+$/
        ) &&
        request.method === "PUT"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const id =
          Number(
            url.pathname.split("/").at(-1)
          );

        const data =
          await safeJson(request);

        if (!data) {
          return Response.json(
            { error: "Invalid request." },
            { status: 400 }
          );
        }

        await env.DB.prepare(`
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
            featured = ?,
            status = ?
          WHERE id = ?
        `)
          .bind(
            String(data.name || "").trim(),
            String(data.slug || "").trim(),
            clean(data.description),
            numberOrNull(data.city_id),
            clean(data.area),
            clean(data.address),
            clean(data.phone),
            clean(data.website),
            clean(data.cuisine),
            clean(data.price_range) || "$$",
            data.featured ? 1 : 0,
            data.status || "published",
            id
          )
          .run();

        return Response.json({
          success: true
        });
      }


      /* =========================================================
         ADMIN API — DELETE RESTAURANT
      ========================================================= */

      if (
        url.pathname.match(
          /^\/api\/admin\/restaurants\/\d+$/
        ) &&
        request.method === "DELETE"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const id =
          Number(
            url.pathname.split("/").at(-1)
          );

        await env.DB.prepare(`
          DELETE FROM restaurants
          WHERE id = ?
        `)
          .bind(id)
          .run();

        return Response.json({
          success: true
        });
      }


      /* =========================================================
         ADMIN API — CITIES
      ========================================================= */

      if (
        url.pathname === "/api/admin/cities" &&
        request.method === "GET"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const { results } =
          await env.DB.prepare(`
            SELECT *
            FROM cities
            ORDER BY name ASC
          `).all();

        return Response.json(results);
      }


      if (
        url.pathname === "/api/admin/cities" &&
        request.method === "POST"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const data =
          await safeJson(request);

        const name =
          String(data?.name || "").trim();

        const slug =
          String(
            data?.slug ||
            slugify(name)
          ).trim();

        if (!name || !slug) {
          return Response.json(
            {
              error:
                "City name is required."
            },
            { status: 400 }
          );
        }

        await env.DB.prepare(`
          INSERT INTO cities (
            name,
            country,
            slug
          )
          VALUES (?, ?, ?)
        `)
          .bind(
            name,
            clean(data.country) || "Pakistan",
            slug
          )
          .run();

        return Response.json({
          success: true
        });
      }


      /* =========================================================
         ADMIN API — RECIPES
      ========================================================= */

      if (
        url.pathname === "/api/admin/recipes" &&
        request.method === "GET"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const { results } =
          await env.DB.prepare(`
            SELECT *
            FROM recipes
            ORDER BY created_at DESC
          `).all();

        return Response.json(results);
      }


      if (
        url.pathname === "/api/admin/recipes" &&
        request.method === "POST"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const data =
          await safeJson(request);

        const title =
          String(data?.title || "").trim();

        const slug =
          String(
            data?.slug ||
            slugify(title)
          ).trim();

        if (!title || !slug) {
          return Response.json(
            {
              error:
                "Recipe title is required."
            },
            { status: 400 }
          );
        }

        const result =
          await env.DB.prepare(`
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
              featured,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
          `)
            .bind(
              title,
              slug,
              clean(data.description),
              clean(data.category),
              clean(data.cuisine),
              numberOrZero(data.prep_minutes),
              numberOrZero(data.cook_minutes),
              numberOrOne(data.servings),
              clean(data.difficulty) || "Easy",
              data.featured ? 1 : 0,
              data.status || "published"
            )
            .first();

        const recipeId =
          Number(result.id);

        await saveRecipeParts(
          env,
          recipeId,
          data.ingredients || [],
          data.steps || []
        );

        return Response.json({
          success: true,
          id: recipeId
        });
      }


      /* =========================================================
         ADMIN API — DELETE RECIPE
      ========================================================= */

      if (
        url.pathname.match(
          /^\/api\/admin\/recipes\/\d+$/
        ) &&
        request.method === "DELETE"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const id =
          Number(
            url.pathname.split("/").at(-1)
          );

        await env.DB.prepare(`
          DELETE FROM recipes
          WHERE id = ?
        `)
          .bind(id)
          .run();

        return Response.json({
          success: true
        });
      }


      /* =========================================================
         ADMIN API — FOOD STORIES
      ========================================================= */

      if (
        url.pathname === "/api/admin/stories" &&
        request.method === "GET"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const { results } =
          await env.DB.prepare(`
            SELECT *
            FROM food_stories
            ORDER BY created_at DESC
          `).all();

        return Response.json(results);
      }


      if (
        url.pathname === "/api/admin/stories" &&
        request.method === "POST"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const data =
          await safeJson(request);

        const title =
          String(data?.title || "").trim();

        const slug =
          String(
            data?.slug ||
            slugify(title)
          ).trim();

        const content =
          String(data?.content || "").trim();

        if (
          !title ||
          !slug ||
          !content
        ) {
          return Response.json(
            {
              error:
                "Title and content are required."
            },
            { status: 400 }
          );
        }

        await env.DB.prepare(`
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
        `)
          .bind(
            title,
            slug,
            clean(data.excerpt),
            content,
            clean(data.author_name) || "Tastify",
            clean(data.category),
            data.featured ? 1 : 0,
            data.status || "published"
          )
          .run();

        return Response.json({
          success: true
        });
      }


      /* =========================================================
         ADMIN API — DELETE STORY
      ========================================================= */

      if (
        url.pathname.match(
          /^\/api\/admin\/stories\/\d+$/
        ) &&
        request.method === "DELETE"
      ) {
        if (
          !(await isAdmin(request, env))
        ) {
          return unauthorized();
        }

        const id =
          Number(
            url.pathname.split("/").at(-1)
          );

        await env.DB.prepare(`
          DELETE FROM food_stories
          WHERE id = ?
        `)
          .bind(id)
          .run();

        return Response.json({
          success: true
        });
      }


      /* =========================================================
         PUBLIC RESTAURANT PROFILE
      ========================================================= */

      if (
        url.pathname.startsWith("/restaurant/")
      ) {
        const slug =
          decodeURIComponent(
            url.pathname.replace(
              "/restaurant/",
              ""
            )
          );

        const restaurant =
          await env.DB.prepare(`
            SELECT
              r.*,
              c.name AS city
            FROM restaurants r
            LEFT JOIN cities c
              ON r.city_id = c.id
            WHERE r.slug = ?
            AND r.status = 'published'
            LIMIT 1
          `)
            .bind(slug)
            .first();

        if (!restaurant) {
          return new Response(
            notFoundPage(),
            {
              status: 404,
              headers: {
                "content-type":
                  "text/html;charset=UTF-8"
              }
            }
          );
        }

        const { results: reviews } =
          await env.DB.prepare(`
            SELECT
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
          `)
            .bind(restaurant.id)
            .all();

        return new Response(
          restaurantPage(
            restaurant,
            reviews
          ),
          {
            headers: {
              "content-type":
                "text/html;charset=UTF-8",
              "cache-control":
                "no-cache"
            }
          }
        );
      }


      /* =========================================================
         HOMEPAGE
      ========================================================= */

      return new Response(
        await homePage(env),
        {
          headers: {
            "content-type":
              "text/html;charset=UTF-8",
            "cache-control":
              "no-cache"
          }
        }
      );

    } catch (error) {

      return new Response(
        "Tastify database error: " +
        error.message,
        {
          status: 500,
          headers: {
            "content-type":
              "text/plain;charset=UTF-8"
          }
        }
      );
    }
  }
};


/* =============================================================
   AUTHENTICATION
============================================================= */

async function createSession(secret, expires) {

  const payload =
    `admin:${expires}`;

  const signature =
    await hmac(secret, payload);

  return btoa(
    `${payload}:${signature}`
  );
}


async function verifySession(secret, token) {

  try {

    const decoded =
      atob(token);

    const parts =
      decoded.split(":");

    if (parts.length !== 3) {
      return false;
    }

    const role = parts[0];
    const expires =
      Number(parts[1]);

    const signature =
      parts[2];

    if (
      role !== "admin" ||
      !Number.isFinite(expires) ||
      expires < Math.floor(Date.now() / 1000)
    ) {
      return false;
    }

    const expected =
      await hmac(
        secret,
        `admin:${expires}`
      );

    return constantTimeEqual(
      signature,
      expected
    );

  } catch {
    return false;
  }
}


async function hmac(secret, message) {

  const key =
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(message)
    );

  return Array.from(
    new Uint8Array(signature)
  )
    .map(
      b =>
        b.toString(16).padStart(2, "0")
    )
    .join("");
}


function constantTimeEqual(a, b) {

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}


async function isAdmin(request, env) {

  if (
    !env.ADMIN_SECRET
  ) {
    return false;
  }

  const cookie =
    request.headers.get("cookie") || "";

  const match =
    cookie.match(
      /(?:^|;\s*)tastify_admin=([^;]+)/
    );

  if (!match) {
    return false;
  }

  return verifySession(
    env.ADMIN_SECRET,
    match[1]
  );
}


function unauthorized() {

  return Response.json(
    {
      error:
        "Administrator authentication required."
    },
    {
      status: 401
    }
  );
}


/* =============================================================
   RATING CALCULATION
============================================================= */

async function recalculateRestaurant(
  env,
  restaurantId
) {

  /*
    Existing restaurants may contain a historical
    rating/count that predates Tastify's review table.

    Example:
      rating = 4.8
      review_count = 24

    If Tastify currently has only one imported/test
    review, we preserve that historical baseline.

    Future approved reviews are then incorporated
    without destroying the historical rating.
  */

  const restaurant =
    await env.DB.prepare(`
      SELECT
        rating,
        review_count
      FROM restaurants
      WHERE id = ?
    `)
      .bind(restaurantId)
      .first();

  if (!restaurant) {
    return;
  }

  const { results } =
    await env.DB.prepare(`
      SELECT
        overall_rating
      FROM reviews
      WHERE restaurant_id = ?
      AND status = 'approved'
    `)
      .bind(restaurantId)
      .all();

  const approvedCount =
    results.length;

  if (approvedCount === 0) {
    return;
  }

  /*
    Calculate the historical portion by removing
    the current approved review records from the
    restaurant's existing aggregate.
  */

  const oldCount =
    Number(restaurant.review_count || 0);

  const oldRating =
    Number(restaurant.rating || 0);

  const approvedSum =
    results.reduce(
      (sum, row) =>
        sum + Number(row.overall_rating || 0),
      0
    );

  let legacyCount =
    oldCount - approvedCount;

  let legacySum =
    oldRating * oldCount -
    approvedSum;

  if (
    legacyCount < 0 ||
    legacySum < 0
  ) {
    legacyCount = 0;
    legacySum = 0;
  }

  const totalCount =
    legacyCount + approvedCount;

  const totalSum =
    legacySum + approvedSum;

  const newRating =
    totalCount > 0
      ? Math.round(
          (totalSum / totalCount) * 10
        ) / 10
      : 0;

  await env.DB.prepare(`
    UPDATE restaurants
    SET
      rating = ?,
      review_count = ?
    WHERE id = ?
  `)
    .bind(
      newRating,
      totalCount,
      restaurantId
    )
    .run();
}


/* =============================================================
   RECIPE HELPERS
============================================================= */

async function saveRecipeParts(
  env,
  recipeId,
  ingredients,
  steps
) {

  await env.DB.prepare(`
    DELETE FROM recipe_ingredients
    WHERE recipe_id = ?
  `)
    .bind(recipeId)
    .run();

  await env.DB.prepare(`
    DELETE FROM recipe_steps
    WHERE recipe_id = ?
  `)
    .bind(recipeId)
    .run();

  for (
    let i = 0;
    i < ingredients.length;
    i++
  ) {

    const item =
      ingredients[i];

    if (!item) continue;

    if (
      typeof item === "string"
    ) {

      await env.DB.prepare(`
        INSERT INTO recipe_ingredients (
          recipe_id,
          ingredient,
          quantity,
          sort_order
        )
        VALUES (?, ?, ?, ?)
      `)
        .bind(
          recipeId,
          item,
          null,
          i
        )
        .run();

    } else {

      await env.DB.prepare(`
        INSERT INTO recipe_ingredients (
          recipe_id,
          ingredient,
          quantity,
          sort_order
        )
        VALUES (?, ?, ?, ?)
      `)
        .bind(
          recipeId,
          String(item.ingredient || ""),
          clean(item.quantity),
          Number(item.sort_order ?? i)
        )
        .run();
    }
  }

  for (
    let i = 0;
    i < steps.length;
    i++
  ) {

    const item =
      steps[i];

    if (!item) continue;

    const instruction =
      typeof item === "string"
        ? item
        : String(
            item.instruction || ""
          );

    if (!instruction.trim()) {
      continue;
    }

    await env.DB.prepare(`
      INSERT INTO recipe_steps (
        recipe_id,
        step_number,
        instruction
      )
      VALUES (?, ?, ?)
    `)
      .bind(
        recipeId,
        Number(
          item.step_number ||
          i + 1
        ),
        instruction
      )
      .run();
  }
}


/* =============================================================
   ADMIN DASHBOARD
============================================================= */

async function adminDashboard(env) {

  const pending =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM reviews
      WHERE status = 'pending'
    `).first();

  const restaurants =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM restaurants
    `).first();

  const recipes =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM recipes
    `).first();

  const stories =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM food_stories
    `).first();

  return `<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>Tastify Admin</title>

<style>

:root {
  --emerald:#087f6c;
  --deep:#075c50;
  --cream:#fffaf0;
  --paper:#ffffff;
  --gold:#d8a83e;
  --ink:#17211f;
  --muted:#687572;
  --border:#e5e1d6;
  --danger:#a83d35;
}

* {
  box-sizing:border-box;
}

body {
  margin:0;
  background:var(--cream);
  color:var(--ink);
  font-family:Arial,sans-serif;
}

nav {
  background:var(--deep);
  color:white;
  padding:16px 0;
}

.container {
  width:min(1150px,92%);
  margin:auto;
}

.nav-inner {
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.logo {
  font-family:Georgia,serif;
  font-size:25px;
  font-weight:bold;
}

.logout {
  background:transparent;
  border:1px solid rgba(255,255,255,.5);
  color:white;
  padding:8px 14px;
  border-radius:20px;
}

main {
  padding:35px 0 70px;
}

h1,h2,h3 {
  font-family:Georgia,serif;
}

h1 {
  font-size:42px;
}

.stats {
  display:grid;
  grid-template-columns:
    repeat(4,1fr);
  gap:15px;
}

.stat {
  background:white;
  border:1px solid var(--border);
  border-radius:18px;
  padding:22px;
}

.stat strong {
  display:block;
  font-size:34px;
  color:var(--emerald);
}

.stat span {
  color:var(--muted);
}

.panel {
  background:white;
  border:1px solid var(--border);
  border-radius:20px;
  padding:25px;
  margin-top:25px;
}

.review {
  border-bottom:1px solid var(--border);
  padding:18px 0;
}

.review:last-child {
  border-bottom:0;
}

.review h3 {
  margin:7px 0;
}

.muted {
  color:var(--muted);
}

.actions {
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  margin-top:12px;
}

button,
.btn {
  border:0;
  border-radius:22px;
  padding:10px 16px;
  font-weight:bold;
  cursor:pointer;
}

.approve {
  background:var(--emerald);
  color:white;
}

.reject {
  background:#eee;
  color:var(--danger);
}

.primary {
  background:var(--emerald);
  color:white;
}

.danger {
  background:var(--danger);
  color:white;
}

input,
textarea,
select {
  width:100%;
  padding:11px;
  border:1px solid #d8d5ca;
  border-radius:8px;
  background:#fffdf8;
  font:inherit;
}

label {
  display:block;
  font-size:13px;
  font-weight:bold;
  margin:12px 0 5px;
}

.form-grid {
  display:grid;
  grid-template-columns:
    repeat(2,1fr);
  gap:15px;
}

.form-grid .full {
  grid-column:1/-1;
}

.notice {
  padding:12px;
  background:#edf7f4;
  border-radius:10px;
  margin-bottom:15px;
}

@media(max-width:700px) {

  .stats {
    grid-template-columns:
      repeat(2,1fr);
  }

  .form-grid {
    grid-template-columns:1fr;
  }

}

</style>

</head>

<body>

<nav>

<div class="container nav-inner">

<div class="logo">
✦ Tastify Admin
</div>

<button class="logout"
onclick="logout()">
Logout
</button>

</div>

</nav>

<main>

<div class="container">

<h1>
Dashboard
</h1>

<p class="muted">
Manage Tastify content and reviews.
</p>

<div class="stats">

<div class="stat">
<strong id="pendingCount">
${Number(pending?.count || 0)}
</strong>
<span>Pending Reviews</span>
</div>

<div class="stat">
<strong>
${Number(restaurants?.count || 0)}
</strong>
<span>Restaurants</span>
</div>

<div class="stat">
<strong>
${Number(recipes?.count || 0)}
</strong>
<span>Recipes</span>
</div>

<div class="stat">
<strong>
${Number(stories?.count || 0)}
</strong>
<span>Food Stories</span>
</div>

</div>


<section class="panel">

<h2>
Review Moderation
</h2>

<div id="reviews">
Loading reviews...
</div>

</section>


<section class="panel">

<h2>
Add Restaurant
</h2>

<form id="restaurantForm">

<div class="form-grid">

<div>
<label>Name</label>
<input name="name" required>
</div>

<div>
<label>Slug</label>
<input
name="slug"
placeholder="leave blank to generate"
>
</div>

<div>
<label>City ID</label>
<input
name="city_id"
type="number"
>
</div>

<div>
<label>Area</label>
<input name="area">
</div>

<div>
<label>Cuisine</label>
<input name="cuisine">
</div>

<div>
<label>Price Range</label>
<select name="price_range">
<option value="$$">$</option>
<option value="$$">$$</option>
<option value="$$$">$$$</option>
<option value="$$$$">$$$$</option>
</select>
</div>

<div>
<label>Phone</label>
<input name="phone">
</div>

<div>
<label>Website</label>
<input name="website">
</div>

<div class="full">
<label>Address</label>
<input name="address">
</div>

<div class="full">
<label>Description</label>
<textarea name="description"></textarea>
</div>

<div>
<label>Status</label>
<select name="status">
<option value="published">Published</option>
<option value="draft">Draft</option>
</select>
</div>

<div>
<label>
<input
type="checkbox"
name="featured"
style="width:auto">
 Featured
</label>
</div>

</div>

<button
class="primary"
type="submit">
Add Restaurant
</button>

</form>

<div id="restaurantMessage"></div>

</section>


<section class="panel">

<h2>
Add Recipe
</h2>

<form id="recipeForm">

<div class="form-grid">

<div>
<label>Title</label>
<input name="title" required>
</div>

<div>
<label>Slug</label>
<input name="slug">
</div>

<div>
<label>Category</label>
<input name="category">
</div>

<div>
<label>Cuisine</label>
<input name="cuisine">
</div>

<div>
<label>Prep Minutes</label>
<input
name="prep_minutes"
type="number"
value="0">
</div>

<div>
<label>Cook Minutes</label>
<input
name="cook_minutes"
type="number"
value="0">
</div>

<div>
<label>Servings</label>
<input
name="servings"
type="number"
value="1">
</div>

<div>
<label>Difficulty</label>
<select name="difficulty">
<option>Easy</option>
<option>Medium</option>
<option>Hard</option>
</select>
</div>

<div class="full">
<label>Description</label>
<textarea name="description"></textarea>
</div>

<div class="full">
<label>
Ingredients
</label>

<textarea
name="ingredients"
placeholder="One ingredient per line&#10;2 potatoes&#10;1 onion&#10;1 tsp salt">
</textarea>
</div>

<div class="full">
<label>
Steps
</label>

<textarea
name="steps"
placeholder="One step per line">
</textarea>
</div>

<div>
<label>Status</label>
<select name="status">
<option value="published">Published</option>
<option value="draft">Draft</option>
</select>
</div>

</div>

<button
class="primary"
type="submit">
Add Recipe
</button>

</form>

<div id="recipeMessage"></div>

</section>


<section class="panel">

<h2>
Add Food Story
</h2>

<form id="storyForm">

<div class="form-grid">

<div>
<label>Title</label>
<input name="title" required>
</div>

<div>
<label>Slug</label>
<input name="slug">
</div>

<div>
<label>Category</label>
<input name="category">
</div>

<div>
<label>Author</label>
<input
name="author_name"
value="Tastify">
</div>

<div class="full">
<label>Excerpt</label>
<textarea name="excerpt"></textarea>
</div>

<div class="full">
<label>Content</label>
<textarea
name="content"
required
style="min-height:200px">
</textarea>
</div>

<div>
<label>Status</label>
<select name="status">
<option value="published">Published</option>
<option value="draft">Draft</option>
</select>
</div>

</div>

<button
class="primary"
type="submit">
Publish Story
</button>

</form>

<div id="storyMessage"></div>

</section>

</div>

</main>


<script>

async function api(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      options
    );

  const data =
    await response.json();

  if (
    response.status === 401
  ) {
    location.href = "/admin";
    throw new Error(
      "Session expired."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Request failed."
    );
  }

  return data;
}


async function loadReviews() {

  const box =
    document.getElementById(
      "reviews"
    );

  try {

    const reviews =
      await api(
        "/api/admin/reviews?status=pending"
      );

    if (!reviews.length) {

      box.innerHTML = `
        <div class="notice">
          ✓ No pending reviews.
        </div>
      `;

      return;
    }

    box.innerHTML =
      reviews.map(
        review => `

        <article class="review">

          <div>
            <strong>
              ${escapeHtml(
                review.restaurant_name
              )}
            </strong>
          </div>

          <div class="rating">
            ★ ${review.overall_rating}/5
          </div>

          <h3>
            ${escapeHtml(
              review.title ||
              "Tastify Review"
            )}
          </h3>

          <p>
            ${escapeHtml(
              review.body
            )}
          </p>

          <p class="muted">
            By
            ${escapeHtml(
              review.author_name
            )}
            ·
            ${escapeHtml(
              review.created_at
            )}
          </p>

          <div class="actions">

            <button
              class="approve"
              onclick="approveReview(
                ${review.id}
              )">
              ✓ Approve
            </button>

            <button
              class="reject"
              onclick="rejectReview(
                ${review.id}
              )">
              ✕ Reject
            </button>

          </div>

        </article>
      `
      ).join("");

  } catch (error) {

    box.innerHTML =
      `<p>${escapeHtml(
        error.message
      )}</p>`;
  }
}


async function approveReview(id) {

  if (
    !confirm(
      "Approve this review?"
    )
  ) {
    return;
  }

  await api(
    `/api/admin/reviews/${id}/approve`,
    {
      method:"POST"
    }
  );

  await loadReviews();

  updateStats();
}


async function rejectReview(id) {

  if (
    !confirm(
      "Reject this review?"
    )
  ) {
    return;
  }

  await api(
    `/api/admin/reviews/${id}/reject`,
    {
      method:"POST"
    }
  );

  await loadReviews();

  updateStats();
}


document
  .getElementById("restaurantForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const form =
        new FormData(
          event.target
        );

      const data =
        Object.fromEntries(
          form.entries()
        );

      data.featured =
        form.has("featured");

      try {

        await api(
          "/api/admin/restaurants",
          {
            method:"POST",
            headers:{
              "content-type":
                "application/json"
            },
            body:
              JSON.stringify(data)
          }
        );

        event.target.reset();

        document
          .getElementById(
            "restaurantMessage"
          )
          .textContent =
          "✓ Restaurant added.";

        setTimeout(
          () => location.reload(),
          700
        );

      } catch (error) {

        document
          .getElementById(
            "restaurantMessage"
          )
          .textContent =
          "Error: " +
          error.message;
      }
    }
  );


document
  .getElementById("recipeForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const form =
        new FormData(
          event.target
        );

      const data =
        Object.fromEntries(
          form.entries()
        );

      data.ingredients =
        String(
          data.ingredients || ""
        )
          .split("\n")
          .map(
            x => x.trim()
          )
          .filter(Boolean);

      data.steps =
        String(
          data.steps || ""
        )
          .split("\n")
          .map(
            x => x.trim()
          )
          .filter(Boolean);

      try {

        await api(
          "/api/admin/recipes",
          {
            method:"POST",
            headers:{
              "content-type":
                "application/json"
            },
            body:
              JSON.stringify(data)
          }
        );

        event.target.reset();

        document
          .getElementById(
            "recipeMessage"
          )
          .textContent =
          "✓ Recipe added.";

      } catch (error) {

        document
          .getElementById(
            "recipeMessage"
          )
          .textContent =
          "Error: " +
          error.message;
      }
    }
  );


document
  .getElementById("storyForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const form =
        new FormData(
          event.target
        );

      const data =
        Object.fromEntries(
          form.entries()
        );

      try {

        await api(
          "/api/admin/stories",
          {
            method:"POST",
            headers:{
              "content-type":
                "application/json"
            },
            body:
              JSON.stringify(data)
          }
        );

        event.target.reset();

        document
          .getElementById(
            "storyMessage"
          )
          .textContent =
          "✓ Food story created.";

      } catch (error) {

        document
          .getElementById(
            "storyMessage"
          )
          .textContent =
          "Error: " +
          error.message;
      }
    }
  );


async function logout() {

  await fetch(
    "/admin/logout",
    {
      method:"POST"
    }
  );

  location.href =
    "/admin";
}


async function updateStats() {

  try {

    const stats =
      await api(
        "/api/admin/stats"
      );

    document
      .getElementById(
        "pendingCount"
      )
      .textContent =
      stats.pending_reviews;

  } catch {}
}


function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


loadReviews();

</script>

</body>

</html>`;
}


/* =============================================================
   ADMIN LOGIN PAGE
============================================================= */

function adminLoginPage() {

  return `<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>Tastify Admin Login</title>

<style>

body {
  margin:0;
  min-height:100vh;
  display:grid;
  place-items:center;
  background:#fffaf0;
  font-family:Arial,sans-serif;
  color:#17211f;
}

.card {
  width:min(400px,90%);
  background:white;
  border:1px solid #e5e1d6;
  border-radius:22px;
  padding:30px;
  box-shadow:
    0 15px 45px
    rgba(20,50,45,.1);
}

h1 {
  font-family:Georgia,serif;
  color:#075c50;
}

input {
  width:100%;
  box-sizing:border-box;
  padding:14px;
  border:1px solid #d8d5ca;
  border-radius:9px;
  font-size:16px;
}

button {
  width:100%;
  margin-top:15px;
  padding:14px;
  border:0;
  border-radius:25px;
  background:#087f6c;
  color:white;
  font-weight:bold;
  font-size:15px;
}

#error {
  color:#a83d35;
  margin-top:15px;
}

a {
  display:block;
  margin-top:20px;
  text-align:center;
  color:#087f6c;
}

</style>

</head>

<body>

<div class="card">

<div style="font-size:35px">
✦
</div>

<h1>
Tastify Admin
</h1>

<p>
Enter your administrator password.
</p>

<form id="login">

<input
type="password"
name="password"
placeholder="Admin password"
required
autocomplete="current-password"
>

<button>
Sign In
</button>

</form>

<div id="error"></div>

<a href="/">
← Back to Tastify
</a>

</div>


<script>

document
  .getElementById("login")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const password =
        new FormData(
          event.target
        ).get("password");

      const error =
        document.getElementById(
          "error"
        );

      error.textContent =
        "Signing in...";

      try {

        const response =
          await fetch(
            "/admin/login",
            {
              method:"POST",
              headers:{
                "content-type":
                  "application/json"
              },
              body:
                JSON.stringify({
                  password
                })
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "Login failed."
          );
        }

        location.href =
          "/admin";

      } catch (err) {

        error.textContent =
          err.message;
      }

    }
  );

</script>

</body>

</html>`;
}


/* =============================================================
   PUBLIC HOME PAGE
============================================================= */

async function homePage(env) {

  const { results } =
    await env.DB.prepare(`
      SELECT
        r.id,
        r.name,
        r.slug,
        r.description,
        r.area,
        r.cuisine,
        r.price_range,
        r.rating,
        r.review_count,
        c.name AS city
      FROM restaurants r
      LEFT JOIN cities c
        ON r.city_id = c.id
      WHERE r.status = 'published'
      ORDER BY
        r.featured DESC,
        r.rating DESC
    `).all();

  const cards =
    results.map(
      r => `

      <article class="restaurant-card">

        <div class="restaurant-image">
          🍽️
        </div>

        <div>

          <div class="rating">
            ★
            ${Number(
              r.rating
            ).toFixed(1)}
          </div>

          <h3>
            ${escapeHtml(r.name)}
          </h3>

          <p>
            ${escapeHtml(
              r.cuisine ||
              "Restaurant"
            )}
          </p>

          <p class="muted">
            📍
            ${escapeHtml(
              r.area || ""
            )},
            ${escapeHtml(
              r.city || ""
            )}
            ·
            ${escapeHtml(
              r.price_range ||
              "$$"
            )}
          </p>

          <p class="muted">
            ${escapeHtml(
              r.description || ""
            )}
          </p>

          <p class="reviews">
            ${Number(
              r.review_count
            )}
            reviews
          </p>

          <a
            class="button"
            href="/restaurant/${encodeURIComponent(
              r.slug
            )}">
            View Restaurant →
          </a>

        </div>

      </article>
    `
    ).join("");

  return `<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1">

<title>
Tastify — Discover With Tastify
</title>

<style>

:root {
  --emerald:#087f6c;
  --deep:#075c50;
  --cream:#fffaf0;
  --paper:#ffffff;
  --gold:#d8a83e;
  --ink:#17211f;
  --muted:#687572;
  --border:#e5e1d6;
}

* {
  box-sizing:border-box;
}

body {
  margin:0;
  background:var(--cream);
  color:var(--ink);
  font-family:Arial,sans-serif;
  line-height:1.6;
}

h1,h2,h3 {
  font-family:Georgia,serif;
}

.container {
  width:min(1100px,92%);
  margin:auto;
}

nav {
  background:white;
  border-bottom:
    1px solid var(--border);
  padding:18px 0;
}

.nav-inner {
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.logo {
  font-family:Georgia,serif;
  font-size:28px;
  font-weight:bold;
  color:var(--deep);
  text-decoration:none;
}

.logo span {
  display:inline-grid;
  place-items:center;
  width:34px;
  height:34px;
  border-radius:50%;
  background:var(--emerald);
  color:white;
  margin-right:7px;
}

.nav-links {
  display:flex;
  gap:20px;
}

.nav-links a {
  color:var(--deep);
  text-decoration:none;
  font-weight:bold;
}

.admin-link {
  color:var(--emerald) !important;
}

.hero {
  padding:75px 0;
  background:
    radial-gradient(
      circle at 85% 20%,
      rgba(216,168,62,.25),
      transparent 25%
    ),
    var(--cream);
}

.eyebrow {
  color:var(--emerald);
  font-size:12px;
  font-weight:bold;
  letter-spacing:2px;
  text-transform:uppercase;
}

.hero h1 {
  font-size:
    clamp(48px,8vw,78px);
  line-height:1;
  margin:18px 0;
}

.hero h1 span {
  color:var(--emerald);
  font-style:italic;
}

.hero p {
  max-width:650px;
  color:var(--muted);
  font-size:18px;
}

.tagline {
  margin-top:25px;
  border-left:
    3px solid var(--gold);
  padding-left:15px;
  font-family:Georgia,serif;
  font-style:italic;
  color:#665d4a;
  font-size:13px;
}

section {
  padding:65px 0;
}

.section-heading {
  margin-bottom:30px;
}

.section-heading h2 {
  font-size:40px;
  margin:8px 0;
}

.section-heading p {
  color:var(--muted);
}

.restaurant-list {
  display:grid;
  gap:18px;
}

.restaurant-card {
  background:white;
  border:
    1px solid var(--border);
  border-radius:20px;
  padding:18px;
  display:grid;
  grid-template-columns:
    170px 1fr;
  gap:22px;
  transition:.2s;
}

.restaurant-card:hover {
  transform:
    translateY(-3px);

  box-shadow:
    0 12px 30px
    rgba(20,50,45,.1);
}

.restaurant-image {
  min-height:160px;
  border-radius:15px;
  display:grid;
  place-items:center;
  font-size:65px;
  background:
    linear-gradient(
      135deg,
      #dff4ee,
      #f5dfaa
    );
}

.restaurant-card h3 {
  font-size:27px;
  margin:4px 0;
}

.restaurant-card p {
  margin:5px 0;
}

.rating {
  color:#b27b0e;
  font-weight:bold;
}

.muted {
  color:var(--muted);
}

.reviews {
  font-size:13px;
  color:var(--muted);
}

.button {
  display:inline-block;
  margin-top:12px;
  padding:10px 17px;
  border-radius:25px;
  background:var(--emerald);
  color:white;
  text-decoration:none;
  font-weight:bold;
  font-size:13px;
}

.quote {
  background:var(--deep);
  color:white;
  text-align:center;
}

.quote h2 {
  max-width:800px;
  margin:auto;
  font-size:38px;
}

footer {
  background:#10201d;
  color:#b8c4c0;
  text-align:center;
  padding:35px 0;
}

footer strong {
  color:var(--gold);
  font-family:Georgia,serif;
  font-size:24px;
}

@media(max-width:650px) {

  .nav-links {
    display:none;
  }

  .restaurant-card {
    grid-template-columns:1fr;
  }

  .restaurant-image {
    min-height:190px;
  }

  .hero {
    padding:55px 0;
  }

}

</style>

</head>

<body>

<nav>

<div class="container nav-inner">

<a href="/" class="logo">
<span>✦</span>Tastify
</a>

<div class="nav-links">

<a href="/">
Home
</a>

<a href="#restaurants">
Restaurants
</a>

<a href="#">
Recipes
</a>

<a href="#">
Reviews
</a>

<a
class="admin-link"
href="/admin">
Admin
</a>

</div>

</div>

</nav>

<main>

<section class="hero">

<div class="container">

<div class="eyebrow">
Food • Art • Discovery
</div>

<h1>
Discover<br>
<span>With Tastify.</span>
</h1>

<p>
Discover restaurants, explore recipes,
read reviews and find something worth tasting.
</p>

<div class="tagline">
IN THE REALMS WHERE FOOD AND ART UNITE,
WE ASPIRE TO BE MAGICIANS.
</div>

</div>

</section>

<section id="restaurants">

<div class="container">

<div class="section-heading">

<div class="eyebrow">
Discover Nearby
</div>

<h2>
Restaurant Guide
</h2>

<p>
Restaurants currently published on Tastify.
</p>

</div>

<div class="restaurant-list">

${cards || `
<p class="muted">
No restaurants have been published yet.
</p>
`}

</div>

</div>

</section>

<section class="quote">

<div class="container">

<h2>
Good food is an experience worth discovering.
</h2>

</div>

</section>

</main>

<footer>

<div class="container">

<strong>
Tastify
</strong>

<p>
Discover With Tastify
</p>

<p>
IN THE REALMS WHERE FOOD AND ART UNITE,
WE ASPIRE TO BE MAGICIANS.
</p>

</div>

</footer>

</body>

</html>`;
}


/* =============================================================
   RESTAURANT PAGE
============================================================= */

function restaurantPage(
  restaurant,
  reviews
) {

  const reviewHTML =
    reviews.length
      ? reviews.map(
          review => `

          <article class="review">

            <div class="rating">
              ★
              ${Number(
                review.overall_rating
              )}/5
            </div>

            <h3>
              ${escapeHtml(
                review.title ||
                "Tastify Review"
              )}
            </h3>

            <p>
              ${escapeHtml(
                review.body
              )}
            </p>

            <small>
              ${escapeHtml(
                review.author_name
              )}
            </small>

          </article>
        `
        ).join("")
      : `
        <p class="muted">
          No approved reviews yet.
        </p>
      `;

  return `<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1">

<title>
${escapeHtml(
  restaurant.name
)}
— Tastify
</title>

<style>

body {
  margin:0;
  background:#fffaf0;
  color:#17211f;
  font-family:Arial,sans-serif;
  line-height:1.6;
}

.container {
  width:min(900px,92%);
  margin:auto;
}

.hero {
  background:#075c50;
  color:white;
  padding:55px 0;
}

h1,h2,h3 {
  font-family:Georgia,serif;
}

h1 {
  font-size:50px;
  margin:10px 0;
}

.rating {
  color:#c18b1a;
  font-weight:bold;
}

.hero .rating {
  color:#f2c95b;
}

main {
  padding:45px 0;
}

.info {
  background:white;
  padding:25px;
  border-radius:20px;
  border:1px solid #e5e1d6;
}

.meta {
  color:#687572;
  line-height:2;
}

.button {
  display:inline-block;
  margin-bottom:25px;
  color:#087f6c;
  text-decoration:none;
  font-weight:bold;
}

.review {
  background:white;
  border-bottom:
    1px solid #e5e1d6;
  padding:22px 0;
}

.review p {
  color:#687572;
}

.form-card {
  background:white;
  padding:25px;
  border-radius:20px;
  border:
    1px solid #e5e1d6;
  margin-top:30px;
}

.form-row {
  display:grid;
  grid-template-columns:
    1fr 1fr;
  gap:12px;
}

label {
  display:block;
  font-weight:bold;
  font-size:13px;
  margin:12px 0 5px;
}

input,
textarea,
select {
  width:100%;
  padding:12px;
  border:
    1px solid #d8d5ca;
  border-radius:8px;
  font:inherit;
  background:#fffdf8;
}

textarea {
  min-height:130px;
  resize:vertical;
}

.submit {
  margin-top:18px;
  background:#087f6c;
  color:white;
  border:0;
  padding:13px 20px;
  border-radius:25px;
  font-weight:bold;
}

#message {
  margin-top:15px;
  font-weight:bold;
}

@media(max-width:600px) {

  .form-row {
    grid-template-columns:1fr;
  }

  h1 {
    font-size:40px;
  }

}

</style>

</head>

<body>

<header class="hero">

<div class="container">

<a
class="button"
href="/">
← Back to Tastify
</a>

<div>
RESTAURANT PROFILE
</div>

<h1>
${escapeHtml(
  restaurant.name
)}
</h1>

<div class="rating">
★
${Number(
  restaurant.rating
).toFixed(1)}
</div>

</div>

</header>

<main>

<div class="container">

<section class="info">

<h2>
About
</h2>

<p>
${escapeHtml(
  restaurant.description ||
  ""
)}
</p>

<div class="meta">

<strong>
📍 Location:
</strong>

${escapeHtml(
  restaurant.area ||
  ""
)},
${escapeHtml(
  restaurant.city ||
  ""
)}

<br>

<strong>
🍽 Cuisine:
</strong>

${escapeHtml(
  restaurant.cuisine ||
  "Not specified"
)}

<br>

<strong>
💰 Price:
</strong>

${escapeHtml(
  restaurant.price_range ||
  "$$"
)}

<br>

<strong>
⭐ Reviews:
</strong>

${Number(
  restaurant.review_count
)}

</div>

</section>


<section>

<h2>
Reviews
</h2>

${reviewHTML}

</section>


<section class="form-card">

<h2>
Write a Review
</h2>

<p class="muted">
Share your experience.
Your review will be checked by
Tastify before appearing publicly.
</p>

<form id="reviewForm">

<div class="form-row">

<div>

<label>
Your name
</label>

<input
name="author_name"
maxlength="80"
required
>

</div>

<div>

<label>
Email (optional)
</label>

<input
type="email"
name="author_email"
maxlength="150"
>

</div>

</div>

<label>
Review title
</label>

<input
name="title"
maxlength="150"
>

<label>
Overall rating
</label>

<select
name="overall_rating"
required>

<option value="">
Select rating
</option>

<option value="5">
★★★★★ — 5
</option>

<option value="4">
★★★★☆ — 4
</option>

<option value="3">
★★★☆☆ — 3
</option>

<option value="2">
★★☆☆☆ — 2
</option>

<option value="1">
★☆☆☆☆ — 1
</option>

</select>


<div class="form-row">

<div>

<label>
Food
</label>

<select
name="food_rating"
required>

<option value="">
Select
</option>

<option value="5">
5 — Excellent
</option>

<option value="4">
4 — Very good
</option>

<option value="3">
3 — Good
</option>

<option value="2">
2 — Poor
</option>

<option value="1">
1 — Very poor
</option>

</select>

</div>


<div>

<label>
Service
</label>

<select
name="service_rating"
required>

<option value="">
Select
</option>

<option value="5">
5 — Excellent
</option>

<option value="4">
4 — Very good
</option>

<option value="3">
3 — Good
</option>

<option value="2">
2 — Poor
</option>

<option value="1">
1 — Very poor
</option>

</select>

</div>

</div>


<div class="form-row">

<div>

<label>
Atmosphere
</label>

<select
name="atmosphere_rating"
required>

<option value="">
Select
</option>

<option value="5">
5 — Excellent
</option>

<option value="4">
4 — Very good
</option>

<option value="3">
3 — Good
</option>

<option value="2">
2 — Poor
</option>

<option value="1">
1 — Very poor
</option>

</select>

</div>


<div>

<label>
Value
</label>

<select
name="value_rating"
required>

<option value="">
Select
</option>

<option value="5">
5 — Excellent
</option>

<option value="4">
4 — Very good
</option>

<option value="3">
3 — Good
</option>

<option value="2">
2 — Poor
</option>

<option value="1">
1 — Very poor
</option>

</select>

</div>

</div>


<label>
Your review
</label>

<textarea
name="body"
maxlength="3000"
required
></textarea>


<button
class="submit"
type="submit">
Submit Review
</button>

<div id="message"></div>

</form>

</section>

</div>

</main>


<script>

const form =
document.getElementById(
  "reviewForm"
);

form.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();

    const message =
      document.getElementById(
        "message"
      );

    message.textContent =
      "Submitting...";

    const data =
      Object.fromEntries(
        new FormData(form).entries()
      );

    for (
      const key of [
        "overall_rating",
        "food_rating",
        "service_rating",
        "atmosphere_rating",
        "value_rating"
      ]
    ) {
      data[key] =
        Number(data[key]);
    }

    try {

      const response =
        await fetch(
          "/api/restaurants/${encodeURIComponent(
            restaurant.slug
          )}/reviews",
          {
            method:"POST",
            headers:{
              "content-type":
                "application/json"
            },
            body:
              JSON.stringify(data)
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Unable to submit review."
        );
      }

      message.textContent =
        "✓ " +
        result.message;

      form.reset();

    } catch(error) {

      message.textContent =
        "Error: " +
        error.message;
    }

  }
);

</script>

</body>

</html>`;
}


/* =============================================================
   404
============================================================= */

function notFoundPage() {

  return `<!DOCTYPE html>

<html>

<head>

<meta
name="viewport"
content="width=device-width,initial-scale=1">

<title>
Tastify — Not Found
</title>

<style>

body {
  margin:0;
  min-height:100vh;
  display:grid;
  place-items:center;
  background:#fffaf0;
  color:#17211f;
  font-family:Arial,sans-serif;
  text-align:center;
}

h1 {
  font-family:Georgia,serif;
  font-size:60px;
}

a {
  color:#087f6c;
  font-weight:bold;
}

</style>

</head>

<body>

<div>

<h1>
404
</h1>

<p>
This realm hasn't been discovered yet.
</p>

<a href="/">
Return to Tastify
</a>

</div>

</body>

</html>`;
}


/* =============================================================
   UTILITY FUNCTIONS
============================================================= */

async function safeJson(request) {

  try {
    return await request.json();
  } catch {
    return null;
  }
}


function clean(value) {

  const text =
    String(value ?? "").trim();

  return text || null;
}


function numberOrNull(value) {

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}


function numberOrZero(value) {

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
}


function numberOrOne(value) {

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : 1;
}


function slugify(value) {

  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      "");
}


function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}
