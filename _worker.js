const restaurants = [
  {
    id: "cafe-aylanto",
    name: "Café Aylanto",
    city: "Islamabad",
    area: "F-6",
    cuisine: "Italian • Continental",
    price: "$$$",
    rating: 4.8,
    description: "A polished dining experience with elegant food and a relaxed atmosphere.",
    order: ["Signature Pasta", "Grilled Chicken"]
  },
  {
    id: "spice-garden",
    name: "Spice Garden",
    city: "Islamabad",
    area: "Blue Area",
    cuisine: "Pakistani • Desi",
    price: "$$",
    rating: 4.6,
    description: "Comforting Pakistani favourites in a welcoming setting.",
    order: ["Karahi", "Seekh Kebab"]
  }
];

const recipes = [
  {
    title: "Creamy Garlic Pasta",
    category: "Quick & Easy",
    time: "30 min",
    rating: 4.8,
    description: "A silky, garlicky pasta that's perfect for an easy dinner."
  },
  {
    title: "Crispy Chicken Burgers",
    category: "Comfort Food",
    time: "35 min",
    rating: 4.7,
    description: "Crispy chicken, fresh vegetables and a creamy sauce."
  }
];

const reviews = [
  {
    restaurant: "cafe-aylanto",
    author: "Tastify Guest",
    rating: 5,
    title: "Beautiful experience",
    body: "Great atmosphere and delicious food."
  }
];

const page = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tastify — Discover With Tastify</title>

<style>
:root{
--emerald:#063d32;
--green:#01796f;
--cream:#f6f1df;
--paper:#fffdf5;
--gold:#d8ad52;
--text:#17352d;
--muted:#68756e;
}

*{box-sizing:border-box}

body{
margin:0;
background:var(--cream);
color:var(--text);
font-family:Arial,sans-serif;
}

h1,h2,h3{
font-family:Georgia,serif;
}

.hero{
background:var(--emerald);
color:white;
text-align:center;
padding:65px 20px;
}

.logo{
font-family:Georgia,serif;
font-size:62px;
color:var(--gold);
}

.eyebrow{
font-size:11px;
letter-spacing:3px;
color:var(--gold);
margin-top:5px;
}

.hero h1{
font-size:42px;
margin:22px 0 8px;
}

.hero p{
color:#f5f0df;
}

.tagline{
font-size:11px!important;
letter-spacing:1.5px;
color:#ead6a0!important;
margin-top:28px;
}

nav{
background:var(--paper);
padding:17px;
text-align:center;
border-bottom:1px solid #ddd0b0;
position:sticky;
top:0;
z-index:5;
}

nav a{
color:var(--emerald);
text-decoration:none;
font-weight:bold;
margin:0 12px;
}

.container{
max-width:1100px;
margin:auto;
padding:35px 20px;
}

.search{
display:flex;
gap:8px;
margin-bottom:35px;
}

.search input{
flex:1;
padding:15px;
border:1px solid #d5c7a7;
border-radius:8px;
background:var(--paper);
font-size:16px;
}

button{
border:0;
border-radius:8px;
background:var(--gold);
padding:13px 18px;
font-weight:bold;
color:var(--text);
cursor:pointer;
}

.grid{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:20px;
margin-bottom:50px;
}

.card{
background:var(--paper);
border:1px solid #e1d4b6;
border-radius:12px;
padding:18px;
}

.image{
height:170px;
background:#dfe7df;
border-radius:8px;
display:flex;
align-items:center;
justify-content:center;
color:var(--muted);
margin-bottom:15px;
font-family:Georgia,serif;
font-size:20px;
}

.rating{
color:#a66d08;
font-weight:bold;
}

.muted{
color:var(--muted);
line-height:1.6;
}

.chip{
display:inline-block;
background:#e4eee8;
padding:8px 12px;
border-radius:20px;
margin:3px;
}

.profile{
display:none;
margin-bottom:50px;
}

.review{
border-bottom:1px solid #ded4bd;
padding:15px 0;
}

footer{
background:var(--emerald);
color:white;
text-align:center;
padding:35px;
margin-top:50px;
}

footer strong{
color:var(--gold);
}

@media(max-width:700px){
.grid{
grid-template-columns:1fr;
}
.logo{
font-size:48px;
}
.hero h1{
font-size:31px;
}
.search{
flex-direction:column;
}
}
</style>
</head>

<body>

<header class="hero">
<div class="logo">Tastify</div>
<div class="eyebrow">FOOD • ART • DISCOVERY</div>

<h1>Discover With Tastify</h1>

<p>Good food. Great places. Honest reviews.</p>

<p class="tagline">
IN THE REALMS WHERE FOOD AND ART UNITE,
WE ASPIRE TO BE MAGICIANS.
</p>
</header>

<nav>
<a href="/">Home</a>
<a href="#restaurants">Restaurants</a>
<a href="#recipes">Recipes</a>
<a href="#about">About</a>
</nav>

<main class="container">

<div class="search">
<input id="search" placeholder="Search restaurants, cuisines or recipes">
<button onclick="searchSite()">Search</button>
</div>

<section id="restaurants">
<h2>Restaurant Guide</h2>
<div id="restaurantGrid" class="grid"></div>
</section>

<section id="profile" class="profile"></section>

<section id="recipes">
<h2>Featured Recipes</h2>
<div id="recipeGrid" class="grid"></div>
</section>

<section id="about">
<h2>About Tastify</h2>
<p class="muted">
Tastify is a food discovery platform for recipes, restaurants,
reviews and food stories — where food meets creativity and art.
</p>
</section>

</main>

<footer>
<strong>Tastify</strong>
<br><br>
Discover With Tastify
<br><br>
IN THE REALMS WHERE FOOD AND ART UNITE,
WE ASPIRE TO BE MAGICIANS.
</footer>

<script>

function showRestaurants(list){

document.getElementById("restaurantGrid").innerHTML=list.map(r => \`

<div class="card">

<div class="image">
Restaurant
</div>

<div class="rating">
★ \${r.rating}
</div>

<h3>\${r.name}</h3>

<p class="muted">
\${r.area}, \${r.city}
<br>
\${r.cuisine} · \${r.price}
</p>

<p class="muted">
\${r.description}
</p>

<button onclick="showProfile('\${r.id}')">
View Restaurant
</button>

</div>

\`).join("");

}

function showRecipes(list){

document.getElementById("recipeGrid").innerHTML=list.map(r => \`

<div class="card">

<div class="image">
Recipe
</div>

<div class="rating">
★ \${r.rating}
</div>

<h3>\${r.title}</h3>

<p class="muted">
\${r.category} · \${r.time}
</p>

<p class="muted">
\${r.description}
</p>

</div>

\`).join("");

}

function showProfile(id){

const r=restaurants.find(x=>x.id===id);

const rr=reviews.filter(x=>x.restaurant===id);

document.getElementById("profile").style.display="block";

document.getElementById("profile").innerHTML=\`

<div class="card">

<button onclick="closeProfile()">← Back</button>

<div class="hero" style="margin:20px -18px">

<div class="eyebrow">RESTAURANT PROFILE</div>

<h1>\${r.name}</h1>

<p>★ \${r.rating} · \${r.price}</p>

</div>

<h2>About</h2>

<p class="muted">
\${r.description}
</p>

<h2>What to Order</h2>

<div>
\${r.order.map(x=>\`<span class="chip">\${x}</span>\`).join("")}
</div>

<h2>Reviews</h2>

\${rr.map(x=>\`

<div class="review">

<strong>\${x.title}</strong>

<div class="rating">
★ \${x.rating}
</div>

<p class="muted">
\${x.body}
</p>

<small>\${x.author}</small>

</div>

\`).join("")}

<h2>Write a Review</h2>

<form onsubmit="submitReview(event,'\${r.id}')">

<input name="author" placeholder="Your name" required
style="padding:12px;width:100%;margin-bottom:8px">

<input name="rating" type="number" min="1" max="5"
placeholder="Rating 1–5" required
style="padding:12px;width:100%;margin-bottom:8px">

<input name="title" placeholder="Review title"
style="padding:12px;width:100%;margin-bottom:8px">

<textarea name="body" placeholder="Your review" required
style="padding:12px;width:100%;height:100px;margin-bottom:8px"></textarea>

<br>

<button>Submit Review</button>

</form>

</div>
\`;

document.getElementById("profile").scrollIntoView();

}

function closeProfile(){

document.getElementById("profile").style.display="none";

}

function submitReview(e,id){

e.preventDefault();

alert("Thank you! Your review has been submitted for moderation.");

e.target.reset();

}

function searchSite(){

const q=document.getElementById("search").value.toLowerCase();

showRestaurants(
restaurants.filter(r =>
r.name.toLowerCase().includes(q) ||
r.city.toLowerCase().includes(q) ||
r.cuisine.toLowerCase().includes(q)
)
);

showRecipes(
recipes.filter(r =>
r.title.toLowerCase().includes(q) ||
r.category.toLowerCase().includes(q)
)
);

}

showRestaurants(restaurants);
showRecipes(recipes);

</script>

</body>
</html>
`;

export default {
async fetch(request){
return new Response(page,{
headers:{
"content-type":"text/html;charset=UTF-8"
}
});
}
};
