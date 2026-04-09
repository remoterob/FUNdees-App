-- ── Dishes Archive Migration ─────────────────────────────────────────────
-- Run in Fundees Supabase SQL Editor
-- Snapshot of Fish Bingo dishes, imported for read-only display

CREATE TABLE IF NOT EXISTS dishes_archive (
  id           UUID PRIMARY KEY,
  name         TEXT NOT NULL,
  species_slug TEXT NOT NULL,
  recipe_url   TEXT,
  description  TEXT,
  photo_url    TEXT,
  thumb_url    TEXT,
  source       TEXT NOT NULL DEFAULT 'fishbingo',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dishes_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dishes_archive_read_all" ON dishes_archive FOR SELECT USING (true);

-- Insert snapshot data
INSERT INTO dishes_archive (id, name, species_slug, recipe_url, description, photo_url, thumb_url, created_at) VALUES
  ('7ecc8254-a3ec-4cb0-8eb9-5e1794b3a937', 'Sashimi Platter', 'kingfish-over-15kg', NULL, 'A great dish for those new to sashimi, the lemon in between the slices slightly cook the fish so it’s great for those that might not be into comply raw fish. 

To prepare get a platter and something nice to present it on. I used a taro leave but it could be lettuce or something else. I like to age my fish a little, this makes the fish more tender. Kingfish is great up to 7 days if kept dry in the fridge. 

Cut a lemon in half lengthways, then slice it into half moons, these will go in between each piece of fish. Slice the fish into a thickness of your liking, some prefer thin others thicker, it’s up to you. Then place a piece of lemon between each slice. Do a couple of rows of this and a coupe of rows of just fresh. Serve it up with soy, ginger and wasabi and eat it with chopsticks.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/c6ba52ff-1da7-4d98-81aa-c788b02c6bd9/kingfish-over-15kg-1762071308516.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/c6ba52ff-1da7-4d98-81aa-c788b02c6bd9/kingfish-over-15kg-1762071308516.jpg', '2025-11-02 08:15:13.051406+00'),
  ('c9200e96-2ee7-4446-a29f-fb9cb49db8d1', 'Sweet snapper sambal', 'snapper', NULL, 'Sweet sambal as per Peter Gordon’s recipe in the Sufar club book.  Mix with Crème Fraîche and put in dollops just before serving.   Prep for ceviche is grating zest of lime.  Juice of limes on thinly sliced snapper and let sit for 30-60 mins.  Avocado, salt, red onion.  Easy as.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0851ecb9-c2c5-4401-867a-a4d09d94b66d/snapper-1762151242415.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0851ecb9-c2c5-4401-867a-a4d09d94b66d/snapper-1762151242415.jpg', '2025-11-03 06:27:23.929881+00'),
  ('39cab6e3-c27e-46de-8ff7-9dadb4eb7788', 'Barrier Banana Curry', 'kingfish-over-15kg', NULL, 'My friend  once told me that she and the word ''recipe'' dont go in the same sentence. Well, when camping on the Barrier over summer, it''s certainly all about improvising. So that''s how our fish, banana, and "mystery spice" Barrier curry came about. Fresh fish speared that morning, ripe bananas care of the neighbour, veges from the honesty box stall down the road,  a can of coconut cream from the cupboard, a dash of fish sauce, and a teaspoon of every spice she had in top drawer... Served up with rice, yogurt, and cucumber. If you have red curry paste and a kaffir lime leaf on hand instead of the spice, even better.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0851ecb9-c2c5-4401-867a-a4d09d94b66d/kingfish-over-15kg-1762153437341.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0851ecb9-c2c5-4401-867a-a4d09d94b66d/kingfish-over-15kg-1762153437341.jpg', '2025-11-03 07:03:58.523136+00'),
  ('6e974592-016b-429e-9185-e9f5fc223ddc', 'Pan-fried Porae & pea mash', 'porae', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/7a8350da-c74a-4d1e-80c0-1f175b79b948/porae-1762326794986.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/7a8350da-c74a-4d1e-80c0-1f175b79b948/porae-1762326794986.jpg', '2025-11-05 07:13:21.154794+00'),
  ('afd54e03-168f-4fff-b594-888f7df4d7fa', 'Pan-seared Snapper with lemon brown butter sauce', 'snapper', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/7a8350da-c74a-4d1e-80c0-1f175b79b948/snapper-1762326949748.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/7a8350da-c74a-4d1e-80c0-1f175b79b948/snapper-1762326949748.jpg', '2025-11-05 07:15:55.107426+00'),
  ('8f5aead4-d9a1-48f5-8774-14f8bf190e64', 'Thai Fish Cakes (TikTok)', 'kingfish-over-15kg', NULL, 'just use TikTok for a recipe they''re all much the same.
A great way to use all the trim from processing a kingfish. Ended up with 700g of fish trim after cleaning up the loins, getting all the head meat and scraping the frame. Chuck the blood meat in too, it doesn''t seem to matter much flavor wise.
Kefir lime leaves really makes these fish cakes "pop"', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/7a8350da-c74a-4d1e-80c0-1f175b79b948/kingfish-over-15kg-1762659666676.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/7a8350da-c74a-4d1e-80c0-1f175b79b948/kingfish-over-15kg-1762659666676.jpg', '2025-11-09 03:41:11.077766+00'),
  ('b61b5624-313c-4f54-9a15-41896fa44d53', 'Mum''s Paua', 'paua', NULL, 'Gently fry 2 finely cut shallots
Take them out of pan
Turn up heat. Sear very thinly sliced pāua until edges brown. Add back shallots, add cream and reduce a bit.

You’ve been making it for years. It only takes a few minutes to cook. I used butter for frying.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/4fd38a4b-5119-4712-a843-00303c3ea317/kerrys%20paua.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/4fd38a4b-5119-4712-a843-00303c3ea317/kerrys%20paua.jpg', '2025-11-09 07:12:32.323341+00'),
  ('54b79630-2e3e-440b-9fce-ab2009a0f486', 'Snapper with lemon, ginger, sesame oil and rice', 'snapper', NULL, 'Chops garlic,small red onion, half ginger, half broccoli and red king sweet capsicum.
2 lemons squeeze
Sesame oil
Soy sauce', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0d02979e-2a89-40ff-8953-7d85ce22bd1e/snapper-1762840587814.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0d02979e-2a89-40ff-8953-7d85ce22bd1e/snapper-1762840587814.jpg', '2025-11-11 05:56:30.638347+00'),
  ('6e5fb8f6-8f2b-44fe-a0af-cbf0617962fe', 'Thai coconut curry', 'pink-mao-mao', NULL, '1. Salt fillets & put aside
2. Sautee onions ~6mins
3. Add aromatics - sliced fresh chilli, minced ginger, sliced garlic for ~2 mins 
4. Add coconut milk, fish stock, lime zest, ~spoon of sugar, bring to a simmer
5. Add any extra veggies and cook for a few mins 
6. Add fillets and cover, cook for 6-8 mins 
7. Remove from heat, add squeeze of lime juice and adjust to taste
8. Top with fresh herbs - coriander, chilli (or chilli oil/crisp) and spring onion', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/49e2df61-d0db-4060-9d66-b0a4a656d391/pink-mao-mao-1762982065533.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/49e2df61-d0db-4060-9d66-b0a4a656d391/pink-mao-mao-1762982065533.jpg', '2025-11-12 21:14:33.115212+00'),
  ('ad2982b7-e32f-4427-9175-dfd81ecc649e', 'Sashimi with truffle ponzu', 'trevally', 'https://www.rnz.co.nz/collections/recipes/trevally-sashimi-with-truffle-ponzu', 'Honestly think I prefer fruity ponzus but this was fun to try and others really liked it', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/49e2df61-d0db-4060-9d66-b0a4a656d391/trevally-1762982360462.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/49e2df61-d0db-4060-9d66-b0a4a656d391/trevally-1762982360462.jpg', '2025-11-12 21:19:21.943741+00'),
  ('48ac1456-ac1b-433b-892e-6c8231b2202d', 'Ika mata', 'blue-mao-mao', 'https://www.cuisine.co.nz/recipe/ika-mata/', 'Yummy!! Recipe says let the fish rest in lime juice for 30-3 hours. Depends how cooked through you like it but I prefer leaving it for longer. I also add extra lime juice at the end', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/49e2df61-d0db-4060-9d66-b0a4a656d391/blue-mao-mao-1762982612664.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/49e2df61-d0db-4060-9d66-b0a4a656d391/blue-mao-mao-1762982612664.jpg', '2025-11-12 21:23:35.099578+00'),
  ('5ec5de1c-7034-485c-a9cd-5b6e231120d2', 'Depot fish sliders with preserved lemon mayo', 'butterfish', 'https://www.metromag.co.nz/food/food-etc/recipe-depots-turbot-sliders-with-preserved-lemon-mayo-watercress', 'so easy, so yummy', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/49e2df61-d0db-4060-9d66-b0a4a656d391/butterfish-1762982992582.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/49e2df61-d0db-4060-9d66-b0a4a656d391/butterfish-1762982992582.jpg', '2025-11-12 21:29:53.654309+00'),
  ('596a9cb6-4ef9-4c44-b342-8144246d9d05', 'Smoked fish bagel', 'trevally', 'https://abesbagels.co.nz/recipes/smoked-fish-pate-radish-bagel/', 'Great way to make a small amount of fish go a long way + last longer', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/49e2df61-d0db-4060-9d66-b0a4a656d391/trevally-1763074212651.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/49e2df61-d0db-4060-9d66-b0a4a656d391/trevally-1763074212651.jpg', '2025-11-13 22:50:15.463575+00'),
  ('e769baf6-b39b-45f6-a611-8e492673cfcb', 'Trevally Sashimi', 'trevally', NULL, 'Trevally
Lemon Olive Oil
Lemon Rind
Lemon juice
Shallot
Capers
Salt 
Pepper
Kecap Manis

Thinly slice and place trevally on a plate. Drizzle and arrange other ingredients on top.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/4fd38a4b-5119-4712-a843-00303c3ea317/trevally-1763193987627.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/4fd38a4b-5119-4712-a843-00303c3ea317/trevally-1763193987627.jpg', '2025-11-15 08:06:29.599381+00'),
  ('e7f269e0-3ada-40e4-a11a-79dd03f8fe9e', 'Pink Maomao Poke Bowl', 'pink-mao-mao', NULL, 'Pink Maomao
Soy sauce
Lemon

Cube fish and marinate in soy sauce and lemon juice.

Salad - use what you have, I used:
Bok Choy
Coriander
Basil
Carrot
Cherry Tomatoes
Avocado

Sushi Rice
Sushi Rice Vinegar

Arrange ingredients, sprinkle with Sushi salt - and mix of wakame, sesame seeds and salt.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/4fd38a4b-5119-4712-a843-00303c3ea317/pink-mao-mao-1763194777795.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/4fd38a4b-5119-4712-a843-00303c3ea317/pink-mao-mao-1763194777795.jpg', '2025-11-15 08:19:40.807857+00'),
  ('eebcdd76-7ec7-4380-a64a-e470a0226275', 'Snapper tartare', 'snapper', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0ac97373-f12e-4f4d-86dc-0460f8208012/snapper-1763443818629.webp', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0ac97373-f12e-4f4d-86dc-0460f8208012/snapper-1763443818629.jpg', '2025-11-18 05:30:19.758701+00'),
  ('079a9862-848b-4754-900b-5d4a81dc739e', 'Grilled snapper wings', 'snapper', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0ac97373-f12e-4f4d-86dc-0460f8208012/snapper-1763443867060.webp', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0ac97373-f12e-4f4d-86dc-0460f8208012/snapper-1763443867060.jpg', '2025-11-18 05:31:08.185472+00'),
  ('b04aad33-beb9-4e0e-9e8e-fd73622d3f10', 'Grilled red crayfish with lime and salad', 'red-cray', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0ac97373-f12e-4f4d-86dc-0460f8208012/red-cray-1763443919670.webp', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0ac97373-f12e-4f4d-86dc-0460f8208012/red-cray-1763443919670.jpg', '2025-11-18 05:32:01.342413+00'),
  ('db4537e2-4635-4069-93a1-94e895892d28', 'Trevally sashimi with Nahm Jim sauce', 'trevally', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0ac97373-f12e-4f4d-86dc-0460f8208012/trevally-1763443971411.webp', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0ac97373-f12e-4f4d-86dc-0460f8208012/trevally-1763443971411.jpg', '2025-11-18 05:32:52.575592+00'),
  ('0a1a54d8-97be-4e1e-9007-dd526921aff6', 'Skippers choice', 'kingfish-over-15kg', NULL, 'IkiJime the fish (wire down spine) on catch.  Have an awesome day of spearing.  Pop up to the wheel house and talk shit with your 5 mates, all while the skipper cuts up an amazing spread of sashimi with soy/sesame oil and sweet chili sauce, picked ginger and wasabi.  Boom!', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0851ecb9-c2c5-4401-867a-a4d09d94b66d/Kingfish-1763783693691.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0851ecb9-c2c5-4401-867a-a4d09d94b66d/Kingfish-1763783693691.jpg', '2025-11-22 03:55:14.417765+00'),
  ('60d3c821-abb1-458b-b2c6-05b071cac091', 'Kokoda', 'koheru', NULL, 'Great with koheru or Kahawai.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/48f07b94-ce84-47ac-a4c4-4cda5b347459/koheru-1763928882092.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/48f07b94-ce84-47ac-a4c4-4cda5b347459/koheru-1763928882092.jpg', '2025-11-23 20:14:44.750149+00'),
  ('f5f06e15-4012-4a25-9751-c32667c7ef3a', 'Fish tostada with mango salsa', 'snapper', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/48f07b94-ce84-47ac-a4c4-4cda5b347459/snapper-1763929010061.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/48f07b94-ce84-47ac-a4c4-4cda5b347459/snapper-1763929010061.jpg', '2025-11-23 20:16:52.382263+00'),
  ('c87da413-be6b-4b13-87db-b0215b2e11db', 'Sichuan spicy boiled fish', 'butterfish', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0ac97373-f12e-4f4d-86dc-0460f8208012/butterfish-1764042187528.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0ac97373-f12e-4f4d-86dc-0460f8208012/butterfish-1764042187528.jpg', '2025-11-25 03:43:08.766782+00'),
  ('54ce0877-db7e-498b-913b-1fea7d71d068', 'Bootleg depot “hotdogs”', 'kingfish-over-15kg', 'https://youtu.be/3XEMXnBAkYI?si=Y0Z6Lkh0SQPzZQE7', 'Julie Le Clerc preserved lemons chopped and mixed into best foods mayo.  Slice kingfish 2mm thick and quick session in a hot pan.  Pickled onion, baby spinach and coat the buns in butter and fry in pan.  Mix and devour!', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0851ecb9-c2c5-4401-867a-a4d09d94b66d/Kingfish-1764479290696.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0851ecb9-c2c5-4401-867a-a4d09d94b66d/Kingfish-1764479290696.jpg', '2025-11-30 05:08:12.532159+00'),
  ('69108e12-296c-413a-829d-13bf195fd299', 'Snapper raw with chimichurr', 'snapper', NULL, 'Chops red onion and parsley, coriande, garlic, red wine vinegar. Put all together 😋', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0d02979e-2a89-40ff-8953-7d85ce22bd1e/snapper-1765042489096.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0d02979e-2a89-40ff-8953-7d85ce22bd1e/snapper-1765042489096.jpg', '2025-12-06 17:34:51.401509+00'),
  ('ec37150c-f71e-4d88-949c-06e3a824ba9e', 'North Indian fried fish', 'parore', NULL, 'Chickpea flour with green chillies and garlic water and add ajwain seeds', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0d02979e-2a89-40ff-8953-7d85ce22bd1e/parore-1765042737914.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0d02979e-2a89-40ff-8953-7d85ce22bd1e/parore-1765042737914.jpg', '2025-12-06 17:38:59.684581+00'),
  ('24a46163-d024-4521-9cc8-3263fdd5fd0c', 'North Indian fried fish', 'parore', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/0d02979e-2a89-40ff-8953-7d85ce22bd1e/parore-1765042908236.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/0d02979e-2a89-40ff-8953-7d85ce22bd1e/parore-1765042908236.jpg', '2025-12-06 17:41:50.612572+00'),
  ('c2186662-e751-40ad-9353-134364ef823d', 'Seafood Boil', 'kingfish-over-15kg', NULL, 'There are a bunch of recipes online, I choose an oven bag method. This takes a bit of prep and Id suggest precooked your muscles, potatoes and sausage. I used Kingfish as its a firmer fish and it held together well.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/13a95400-8ef8-43a0-a221-272ca95c544b/Kingfish-1765064078508.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/13a95400-8ef8-43a0-a221-272ca95c544b/Kingfish-1765064078508.jpg', '2025-12-06 23:34:40.54949+00'),
  ('872de731-86f0-40a3-a2c2-922ed944831f', 'Poke Biwl', 'kingfish-over-15kg', NULL, 'A Hawaiian dish, this is fantastic in summer. Rice underneath, with your choice of fresh veges and legume on top. I marinate my kingfisher cubes in 1Tbs lime Juice, 1Tbs crushed chill/garlic sauce, 1tsp and 1/4 cup of soy. Add yum yum and any garnishes you like.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/13a95400-8ef8-43a0-a221-272ca95c544b/Kingfish-1765064273211.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/13a95400-8ef8-43a0-a221-272ca95c544b/Kingfish-1765064273211.jpg', '2025-12-06 23:37:54.974394+00'),
  ('b9d2cdb8-0484-46a4-8499-c8aa79fae457', 'Yellow Fin Sashimi', 'yellowfin-tuna', NULL, 'Mix the soy and wasabi together. Dont tell the kids its ready until you have eaten one plate already.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/13a95400-8ef8-43a0-a221-272ca95c544b/Tuna%20-%20Yellow%20Fin-1765064475533.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/13a95400-8ef8-43a0-a221-272ca95c544b/Tuna%20-%20Yellow%20Fin-1765064475533.jpg', '2025-12-06 23:41:18.406125+00'),
  ('5e7c868d-1fbb-4832-90da-47bff535b50a', 'Pizza à la Parore', 'parore', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/7825fc0f-bac5-44c0-ae69-7772700a6dc5/parore-1765077905483.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/7825fc0f-bac5-44c0-ae69-7772700a6dc5/parore-1765077905483.jpg', '2025-12-07 03:25:08.965754+00'),
  ('6e30ecc7-ceee-4a2f-b945-faba39c0e307', 'Open Flame Butterfish', 'butterfish', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/7825fc0f-bac5-44c0-ae69-7772700a6dc5/butterfish-1765077967316.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/7825fc0f-bac5-44c0-ae69-7772700a6dc5/butterfish-1765077967316.jpg', '2025-12-07 03:26:11.947555+00'),
  ('1dcc497f-0a7c-42a4-9641-689f25699a93', 'Blue Mao Mao fijian style sashimi', 'blue-mao-mao', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/7825fc0f-bac5-44c0-ae69-7772700a6dc5/blue-mao-mao-1765086997332.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/7825fc0f-bac5-44c0-ae69-7772700a6dc5/blue-mao-mao-1765086997332.jpg', '2025-12-07 05:56:41.168584+00'),
  ('dc7115d2-cfea-4c40-8705-10aea60a7370', 'Ika Mata with fresh kingy', 'kingfish-over-15kg', NULL, 'Ika mata-style kingfish using lemon & lime juice for curing, then mixed with coconut milk, red and yellow capsicum, red onion, coriander, and chilli. Served on cucumber slices that have been carved out to make miniature edible bowls for the ika mata to sit in.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/257cbabd-f5fa-49e9-8ff6-3642c9b2011b/Kingfish-1765136114305.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/257cbabd-f5fa-49e9-8ff6-3642c9b2011b/Kingfish-1765136114305.jpg', '2025-12-07 19:35:14.739745+00'),
  ('eb3d590d-a606-4e52-a517-ab3dcfb42de4', 'Parore pizza', 'parore', NULL, 'Cook the parore in cornflour and oil and add to any flavour pizza', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/b6d18962-fb1b-4e6f-aefd-86d088e0e21d/parore-1765153866695.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/b6d18962-fb1b-4e6f-aefd-86d088e0e21d/parore-1765153866695.jpg', '2025-12-08 00:31:09.604479+00'),
  ('a115fc80-911b-4ff5-ad4a-eca803ecd889', 'Trevally with Mango, lime and secret sauce', 'trevally', NULL, 'Thinly sliced Trevally drizzled in a citrus tonkatsu sauce, finished with a squeeze of lime and a sprinkle of fresh cilantro. Paired with sweet mango to bring a vibrant balance of zesty, savoury and tropical flavours.


Ingredients:

200g of Fresh Trevally sliced very thin 
1 fresh lime 
1 tablespoon of Tonkatsu sauce
2 tablespoons of McCoy orange juice 
1/3 cup of diced fresh mango 
2 tablespoons of chopped Cilantro 
Sesame seeds for garnish 
(The photo has Thyme flowers and slices of fresh lime for garnish as well) 

1. Lay your thin slices of Trevally down on the plate creating a border leaving the middle free for the mango.

2. Squeeze fresh lime juice all over the pieces to cure the fish

3. In a small bowl mix your orange juice and tonkatsu sauce until combined. If you would like a bit of heat, add a dash of hot sauce to the secret sauce.

4. Drizzle your secret sauce all over ever single piece making sure each slice is covered evenly.

5. Place all your diced mango into the middle of the plate and sprinkle the chopped cilantro around the outside of the mango creating a border against the fish. 

6. Sprinkle sesame seeds on the fish if desired. Then enjoy ☺️', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/695aced9-a3e0-4969-9a32-5bef824f6f46/trevally-1765262544263.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/695aced9-a3e0-4969-9a32-5bef824f6f46/trevally-1765262544263.jpg', '2025-12-09 06:42:26.513297+00'),
  ('a3795812-3cd6-496d-ad9a-d130b54a1fc6', 'Seared Snapper with creamy Coconut basil sauce', 'snapper', NULL, 'Delicately seared snapper fillet crowned with a coconut cream sauce infused with fresh basil. Served alongside golden, crispy kūmara for the perfect balance of tropical richness and New Zealand comfort.

Ingredients:

2 Snapper Fillets
1 can of coconut cream 
2 cloves of minced fresh garlic 
1/4 cup of grated Parmesan 
3 tablespoons of chopped Basil
4 tablespoons of Olive Oil
3 tablespoons of Garlic Salt seasoning
Salt to taste
1 whole Kūmara cubed.
Basil flowers to garnish.

Method:

1. On a plate sprinkle 1 tablespoon of garlic salt onto the fillets of snapper and set aside 

2. In a bowl, mix together your cubes of Kūmara, 1 tablespoon of Olive oil and the remaining Garlic Salt. Mix together till all pieces of Kūmara are coated evenly. Place into the oven or air fryer until golden brown and crispy

3. Heat up your pan you will cook the fish in so it’s hot enough for a nice sear. I prefer to use a stainless steel pan or cast iron. 

4. Once the pan is hot, pour in 2 tablespoon of Olive oil. Once the oil has reached smoke point, lay your fillets in the pan away from yourself and press the fillet down firmly with a spatula to get a nice crisp. Cook for 1 - 2 min each side depending on how big your fillets are. Make sure you have a golden brown sear before flipping.  Set aside once cooked.

5. To begin the sauce, get a medium saucepan and pour the leftover Olive oil into the pan. 

6. We are aiming for just before smoke point to add the garlic for sautéing so it doesn’t burn. Sauté for 10-15 seconds.

7. Once the garlic is lightly browned and golden, reduce temperature to medium and add the can of Coconut cream, then chopped basil. Keep stiring and reducing the sauce for 5 minutes.

8. Once reduced and slightly thickened, add you grated Parmesan and mix thoroughly to avoid clumps. Keep stirring until you’ve reached you desired thickness. 

9. Add salt to taste then pour sauce into your serving dish, place down the fillets of fish and then border half the plate with the crispy Kūmara.

10. Garnish with leftover basic but I add the Basil flower.

Enjoy ☺️', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/695aced9-a3e0-4969-9a32-5bef824f6f46/snapper-1765264235826.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/695aced9-a3e0-4969-9a32-5bef824f6f46/snapper-1765264235826.jpg', '2025-12-09 07:10:37.671654+00'),
  ('f64d1d42-ddaf-47f9-90af-675f2fc9dfad', 'Smoked Kingfish Quiche', 'kingfish-over-15kg', 'https://spearoskitchen.com/2025/04/16/smoked-yellowtail-kingfish-quiche/', 'A yummy, savoury pastry filled with smoky kingfish and fresh herbs, perfect for sharing or enjoying on your own.

🔗 Click the link for the recipe', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/695aced9-a3e0-4969-9a32-5bef824f6f46/Kingfish-1765264574557.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/695aced9-a3e0-4969-9a32-5bef824f6f46/Kingfish-1765264574557.jpg', '2025-12-09 07:16:16.101964+00'),
  ('d15f2318-9124-494f-bbb5-11a08cabed3f', 'Easy Paua Udon', 'paua', NULL, 'Easy Paua Udon 
(Per serving)
1 Tbsp mirin
1 Tbsp shoyu (light soy sauce)
1 Tbsp white sugar
1 Tbsp bonito flakes
1/2 Tbsp dried wakame flakes
100g thinly sliced paua
300ml water
1 packet udon noodles

 Place noodles in bowl and cover with boiling water for 2 minutes, drain and put back in bowl.
Combine other ingredients in small saucepan and bring to boil. Simmer for 3 minutes until paua slices have curled and wakame has rehydrated. Pour over noodles and serve. 

I like this recipe for its ease to make and tastiness - it is full of ocean flavour.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/d65d4738-6bd9-4987-bd67-71fb502cf766/paua-1765419108947.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/d65d4738-6bd9-4987-bd67-71fb502cf766/paua-1765419108947.jpg', '2025-12-11 02:11:50.75826+00'),
  ('b1341707-eeb2-4fc7-b92e-90fea710238a', 'Kingfish Ceviche', 'kingfish-over-15kg', NULL, 'Kingie slices, tomato, cucumber, red onion, avocado (add chilli, coriander and spring onion if you have them) then just season with lime juice and salt and pepper. Need enough lime juice to soak the fish', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/d65d4738-6bd9-4987-bd67-71fb502cf766/Kingfish-1765419253413.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/d65d4738-6bd9-4987-bd67-71fb502cf766/Kingfish-1765419253413.jpg', '2025-12-11 02:14:15.053246+00'),
  ('9c492e26-6906-456a-abe9-41869b92c269', 'Paua sashimi', 'paua', NULL, 'Paua sashimi
Ingredients:
Whole Paua
Ponzu
Lime wedges
Sesame oil
Wasabi

Easy tender paua method:
While paua is still alive, make a small cut in the foot and store in a bowl in the fridge overnight. It will be dead and tender in the morning, able to be shucked and cleaned of guts and teeth, so that only the foot remains. No further tenderising needed.
Sashimi:
After preparing the paua as above, thinly (as thin as you can!) slice the foot on the shorter span with the knife angled slightly down. Layer slices on plate, or back in the shell if you wanna be fancy.
Sauce:
In a small dipping bowl mix ponzu with a dash of sesame oil. 
Serve with lime wedges and wasabi, to taste.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/d65d4738-6bd9-4987-bd67-71fb502cf766/paua-1765420155024.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/d65d4738-6bd9-4987-bd67-71fb502cf766/paua-1765420155024.jpg', '2025-12-11 02:29:16.392555+00'),
  ('9735057a-16f6-479c-bc2b-4dc75fa5d2f1', 'Egyptian Fried Red Mullet', 'red-mullet', 'https://share.google/Cm8NmjoXObbILDE0x', 'Descale and clean inside the fish with paper towels (no tap water ruins the flesh) butterfly the both sides of fillet and leave on fishes frame. Marinade throughout (see link for ingredients) and let set in freezer for 30mins. Cover the fish in flour then fry in deep pan each side approx 4mins on medium heat. Enjoy!', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/a752c5a3-37a2-4caf-a313-8314670c4669/red-mullet-1765867510696.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/a752c5a3-37a2-4caf-a313-8314670c4669/red-mullet-1765867510696.jpg', '2025-12-16 06:45:12.49768+00'),
  ('b9a37fac-f445-40ec-aab7-a3536d3d963c', 'Smoked fish cabonara', 'kingfish-over-15kg', 'https://www.bonappetit.com/recipe/simple-spaghetti-carbonara?srsltid=AfmBOopZEHWPypi4zXc6U04FiADvH5R4Jn9kli0t-5MdHRRw-yZCVmmx', 'Learn to cook a classic spaghetti cabonara, as per the recipe above. 

Replace the pancetta or guancale with smoked fish. 

Garnish with capers and chopped parsley.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/7a2e1478-77fb-4c53-830d-2eaf5082cdf2/Kingfish-1766079906395.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/7a2e1478-77fb-4c53-830d-2eaf5082cdf2/Kingfish-1766079906395.jpg', '2025-12-18 17:45:08.194094+00'),
  ('be74a952-c63f-44e5-967c-8c016b4f2a12', 'Fried Paroe', 'porae', NULL, 'Porae filets floured and seasoning. Fried in butter and little olive oil. Served with coleslaw.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/14aec115-59b8-4e88-9f5a-4a00d7709aab/porae-1766210900925.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/14aec115-59b8-4e88-9f5a-4a00d7709aab/porae-1766210900925.jpg', '2025-12-20 06:08:25.182468+00'),
  ('05c8f27a-2aad-435d-b2e9-4d0a006eea34', 'Garlic scallops', 'scallop', NULL, 'Shuck scallops, then frie on bbq with butter and garlic.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/14aec115-59b8-4e88-9f5a-4a00d7709aab/Scallop-1766211855610.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/14aec115-59b8-4e88-9f5a-4a00d7709aab/Scallop-1766211855610.jpg', '2025-12-20 06:24:16.702453+00'),
  ('b5905432-bf2e-4ddd-bc2f-cb09b83c2886', 'BBQ crayfish', 'red-cray', NULL, 'Cut cray in half with solid knife, clean out guts etc can wash with s little salt water, cover in butter and garlic. Bbq shell down with lid closed for 15mins', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/14aec115-59b8-4e88-9f5a-4a00d7709aab/red-cray-1766212120247.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/14aec115-59b8-4e88-9f5a-4a00d7709aab/red-cray-1766212120247.jpg', '2025-12-20 06:28:41.216225+00'),
  ('0579d656-dc60-427a-8a76-b7a3b76c0de6', 'Crispy Paua chips', 'paua', 'https://www.facebook.com/Blokescancooktoo/videos/crispy-paua-chips/517786356753871/', '0
SHOP SEAFOOD
CHATHAM BLUE
OUR CATCH
OUR STORY
CHATHAM ISLANDS
RECIPES
CONTACT
Log in
Shopping Cart
Your cart is empty

Continue Shopping
Sliced Paua Recipe

INGREDIENTS

Paua, Whole In Shell 1kg
2 Tablespoons of Olive Oil
1 cup flour
1 x Teaspoon Salt
1 x Teaspoon Pepper
50 grams Butter
1 Lemon 
METHOD

1. Thinly slice Paua across the width of the Paua, slices should be about 2-3mm thick.
2. Place slices in a bay of seasoned flour (mix flour pepper and salt in a bag, approx. cup of flour teaspoon salt, teaspoon pepper) Chili can be added for a little hit of heat.
3. Put 2 tablespoons of olive oil on the pan and get it really hot.
4. Place 50 grams of butter into the pan with the olive oil.
5. When butter is frothing but not burning throw in the thin slices of Paua.
6. Cook for around 1 minute.
7. Take out and squeeze half a lemon over the Paua
8. Serve.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/14aec115-59b8-4e88-9f5a-4a00d7709aab/paua-1766213201506.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/14aec115-59b8-4e88-9f5a-4a00d7709aab/paua-1766213201506.jpg', '2025-12-20 06:46:42.653491+00'),
  ('476fe157-9eb8-4908-921e-5ddbb162044e', 'Crayfish rice paper rolls', 'red-cray', NULL, 'Shredded cabbage, stripe cut cucumber, red onion, coriander, bean sprouts, beetroot and rice paper rolled up ready to dip into hoisin peanut butter sauce', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/a752c5a3-37a2-4caf-a313-8314670c4669/red-cray-1766303956965.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/a752c5a3-37a2-4caf-a313-8314670c4669/red-cray-1766303956965.jpg', '2025-12-21 07:59:51.970928+00'),
  ('81c9f3d1-3d6b-495c-807d-f8d68285e4d4', 'Crayfish ravioli koru', 'red-cray', 'https://www.masterclass.com/articles/gordon-ramsays-famous-lobster-ravioli-recipe#68hsS5uwRa8msKq6a0Eomi', NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/49e2df61-d0db-4060-9d66-b0a4a656d391/red-cray-1766388008398.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/49e2df61-d0db-4060-9d66-b0a4a656d391/red-cray-1766388008398.jpg', '2025-12-22 07:20:10.217681+00'),
  ('b3fbe438-805f-4bb4-b4bd-79700a6b7b18', 'Salt & pepper squid', 'squid', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/2a95c984-9abb-442a-81ee-e2b4d8af7de0/Squid-1766535574979.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/2a95c984-9abb-442a-81ee-e2b4d8af7de0/Squid-1766535574979.jpg', '2025-12-24 00:19:36.130797+00'),
  ('d5d9365e-3ffd-4f65-9936-b51dab2dc18b', 'Parore crumbed secret Santa butterfish', 'parore', NULL, 'Secret Santa bread crumbed parore with potatoes bake and salad. Secret Santa as it was mixed with crumbed butterfish :D Parore tasted better! Think orange bread crumbs are secret way goin about it (will not crumb butterfish again)', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/a752c5a3-37a2-4caf-a313-8314670c4669/parore-1766541643094.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/a752c5a3-37a2-4caf-a313-8314670c4669/parore-1766541643094.jpg', '2025-12-24 02:00:44.310678+00'),
  ('8ef53322-f19a-4a1f-93be-be217d81ac13', 'Ceviche', 'trevally', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/2a95c984-9abb-442a-81ee-e2b4d8af7de0/trevally-1766892582724.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/2a95c984-9abb-442a-81ee-e2b4d8af7de0/trevally-1766892582724.jpg', '2025-12-28 03:29:44.726814+00'),
  ('6d409270-ac4e-4e29-b0a9-2d62496713db', 'Smoke porae', 'porae', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/2a95c984-9abb-442a-81ee-e2b4d8af7de0/porae-1766892641631.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/2a95c984-9abb-442a-81ee-e2b4d8af7de0/porae-1766892641631.jpg', '2025-12-28 03:30:43.569905+00'),
  ('08b6086f-45ff-44e0-ae58-bf6542adb451', 'Salt baked snapper', 'snapper', 'https://www.foodandwine.com/recipes/salt-baked-fish', 'Super easy! A few tips:

- Keep the scales on the fish - it protects the flesh and stops it drying out
- Some recipes suggest mixing salt with egg-whites - Don’t bother
- Use non-iodised sea salt - just the cheapest stuff you can find at the supermarket', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/7a2e1478-77fb-4c53-830d-2eaf5082cdf2/snapper-1766954930673.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/7a2e1478-77fb-4c53-830d-2eaf5082cdf2/snapper-1766954930673.jpg', '2025-12-28 20:49:00.734096+00'),
  ('e3f82a4f-bcc4-454d-904b-c092e25a3ca8', 'Fish offal skewers', 'kingfish-over-15kg', NULL, 'Fish offal skewers

Try to retain some offal from your fish. It is best eaten as fresh as possible. Try liver, skin, hearts.

Get the coals going super hot on a barbecue. Soak the skewers to prevent them burning.

Slice the offal nice and thin, slide onto skewers. Season liberally with salt, and lightly with chilli flakes.

Cook hot and fast over coals. For skin: Try and get it bubbling and crispy like pork crackling. Hearts and livers, cook medium rare.

Put a skewer into someone’s hand along with a beer. Enjoy!', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/7a2e1478-77fb-4c53-830d-2eaf5082cdf2/Kingfish-1767039419213.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/7a2e1478-77fb-4c53-830d-2eaf5082cdf2/Kingfish-1767039419213.jpg', '2025-12-29 20:17:00.579924+00'),
  ('9c1d75ed-4f64-4251-9506-b2c006ad274b', 'BBQ caper kingfish', 'kingfish-over-15kg', NULL, 'Take the belly flaps of the kingfish with skin on. 
Place the cuts onto a large piece of tinfoil.
Rub Oliver oil over it, I used a garlic infused one. Sprinkle salt and pepper over it. Add a dozen or so capers on top. 

Wrap the whole thing up and place it on the BBQ. Keeping the tinfoil closed means it stays moist and cooks through without having to turn it.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/44c0e0c9-df89-428d-bf9b-c3a1b66b135a/Kingfish-1767079748540.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/44c0e0c9-df89-428d-bf9b-c3a1b66b135a/Kingfish-1767079748540.jpg', '2025-12-30 07:29:12.104601+00'),
  ('8d29a7f9-c406-4e04-af38-9d48958e5b10', 'Crazy cray', 'red-cray', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/dc4cac64-29be-4eee-8bed-a2fdbe484015/red-cray-1767342470316.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/dc4cac64-29be-4eee-8bed-a2fdbe484015/red-cray-1767342470316.jpg', '2026-01-02 08:28:22.397381+00'),
  ('51609376-0e8a-4816-9a6a-04b8c8a0b77e', 'Kina on bread', 'paua', NULL, 'Butter bread and add kina roe', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/dc4cac64-29be-4eee-8bed-a2fdbe484015/paua-1767342699539.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/dc4cac64-29be-4eee-8bed-a2fdbe484015/paua-1767342699539.jpg', '2026-01-02 08:31:52.53505+00'),
  ('3dca5be6-01e2-445c-ad65-96838c7062f4', 'Boiled crayfish', 'red-cray', 'Boil for 8 min then use the cray feeler to pull out the poo tube', NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/3aa727e5-d4bf-46cf-bb85-f8b139b8e4e4/red-cray-1767342838112.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/3aa727e5-d4bf-46cf-bb85-f8b139b8e4e4/red-cray-1767342838112.jpg', '2026-01-02 08:34:02.634333+00'),
  ('7156c167-fa65-4199-a41a-7ae71e5ea785', 'Pāua and cray', 'paua', NULL, 'Use a knife and chop cray in half add butter and garlic cook it and a pan or barbecue on high heat for 8 minutes.
Shock your pāua and tenderise it by using a hammer and a rag lightly then cook in a pen or barbecue if you could put for 3 to 4 minutes on each side then slice into pieces.
Enjoy', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/dc4cac64-29be-4eee-8bed-a2fdbe484015/paua-1767343247431.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/dc4cac64-29be-4eee-8bed-a2fdbe484015/paua-1767343247431.jpg', '2026-01-02 08:40:59.168757+00'),
  ('02543815-3c99-4f89-9549-1a52fae676d7', 'Creamy paua', 'paua', NULL, 'Cook cream in a pan with lots of butter and garlic then put it into a different pot then slightly brown, the sliced paua with butter in the pan. Then add it to the pot to thicken.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/3aa727e5-d4bf-46cf-bb85-f8b139b8e4e4/paua-1767343383986.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/3aa727e5-d4bf-46cf-bb85-f8b139b8e4e4/paua-1767343383986.jpg', '2026-01-02 08:43:23.430177+00'),
  ('0fe4ac20-7e2e-4050-80de-ab26232ae473', 'Rice Crumbed Butters', 'butterfish', NULL, 'A wheat-free recipe
Fillet butterfish and leave in the fridge overnight so they will firm up. 
Cube into nugget size, coat with rice flour (add rice flour and spices like salt, pepper, nutmeg, bbq rub, get creative .. to a plastic bag and add fish pieces to coat evenly), then coat with egg (whole egg stirred with fork in bowl), then coat with rice ''bread crumbs'' and shallow fry in butter until golden on both sides. Cooking time is fairly short, best if not overcooked. Crowd pleaser.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/a3333314-9bb4-4d5c-957e-f163ae65153f/butterfish-1767586852568.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/a3333314-9bb4-4d5c-957e-f163ae65153f/butterfish-1767586852568.jpg', '2026-01-05 04:20:56.543667+00'),
  ('ee7c5085-b69b-4828-8669-2028e4efbecc', 'Panfried Parore with sausage backup!', 'parore', NULL, NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/7a8350da-c74a-4d1e-80c0-1f175b79b948/parore-1767780580842.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/7a8350da-c74a-4d1e-80c0-1f175b79b948/parore-1767780580842.jpg', '2026-01-07 10:09:43.064293+00'),
  ('007b0b8b-ff5c-4565-b360-6d0dd3756958', 'Trevally Sashimi', 'trevally', NULL, 'Trevally sashimi dressed with a mix of rice wine vinegar, mirin (or a pinch of sugar if you don''t have it), soy, and fresh lime juice. Served with some wasabi mayo, and garnished with spring onion and coriander.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/257cbabd-f5fa-49e9-8ff6-3642c9b2011b/trevally-1767855473497.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/257cbabd-f5fa-49e9-8ff6-3642c9b2011b/trevally-1767855473497.jpg', '2026-01-08 06:57:55.777069+00'),
  ('bf091afb-cf29-4a36-9ac2-5e85e3e3656f', 'Fish on toast', 'trevally', NULL, 'What I make when I cbf cooking after a day of diving. Can do with any white fish.

Ingredients:
- white fish fillets 
- bread 
- some form of capsicum or tomatoes, (fresh or can use preserved), roughly chopped
- parsley chopped
-lemon or lime
-optional - olives & capers 

1. Make toast
2. Salt& pepper fish fillets. Fry lightly in butter
3. Once fish is cooked, remove from the pan and in that same pan, put a drop of olive oil + capsicum/tomatoes. Cook for a minute or so, then remove from the heat & add some lemon juice & chopped parsley. 
4. Put the fish on the toast & top with capsicum parsley caper mix. Squeeze over more lemon/lime juice to finish', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/49e2df61-d0db-4060-9d66-b0a4a656d391/trevally-1768034271891.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/49e2df61-d0db-4060-9d66-b0a4a656d391/trevally-1768034271891.jpg', '2026-01-10 08:37:53.585286+00'),
  ('39b2bb3b-4472-4836-b69a-ce3c34c01a43', 'Raspberry Crudo', 'trevally', 'https://www.cuisine.co.nz/recipe/shallot-raspberry-malt-vinegar-dressing-on-raw-fish/', NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/49e2df61-d0db-4060-9d66-b0a4a656d391/trevally-1768212480202.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/49e2df61-d0db-4060-9d66-b0a4a656d391/trevally-1768212480202.jpg', '2026-01-12 10:08:05.166031+00'),
  ('8ee20ac7-6600-46a6-a727-ed216d1b9bfa', 'Chargrilled kingfish with chickpea salad', 'kingfish-over-15kg', NULL, 'Another Al Brown “Go Fish” recipe', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/49e2df61-d0db-4060-9d66-b0a4a656d391/Kingfish-1768212570218.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/49e2df61-d0db-4060-9d66-b0a4a656d391/Kingfish-1768212570218.jpg', '2026-01-12 10:09:39.152555+00'),
  ('86beb39c-104b-4af4-a682-b2214f9c0923', 'Simple raw kingy', 'kingfish-over-15kg', NULL, 'Simple ponzu sauce (soy, rice vinegar, lemon, sesame oil) & top with spring onions, chilli & sesame seeds', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/49e2df61-d0db-4060-9d66-b0a4a656d391/Kingfish-1768212929295.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/49e2df61-d0db-4060-9d66-b0a4a656d391/Kingfish-1768212929295.jpg', '2026-01-12 10:15:36.678163+00'),
  ('957305c9-cc88-43a7-82e5-0947ed46e294', 'Deep fried paua', 'paua', 'First cut your paua in half through the foot and tongue then soak in lemon then coat in breadcrumbs and coat and cook then deep fry', NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/3aa727e5-d4bf-46cf-bb85-f8b139b8e4e4/paua-1768259676050.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/3aa727e5-d4bf-46cf-bb85-f8b139b8e4e4/paua-1768259676050.jpg', '2026-01-12 23:14:41.39475+00'),
  ('f79023d6-54d4-4571-a4e5-b686ea743503', 'Boiled pack horse', 'pack-horse-cray', NULL, 'Boiled packy with a wasabi mayo dip! Yum', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/48f07b94-ce84-47ac-a4c4-4cda5b347459/pack-horse-cray-1768351538648.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/48f07b94-ce84-47ac-a4c4-4cda5b347459/pack-horse-cray-1768351538648.jpg', '2026-01-14 00:45:42.259426+00'),
  ('c2528c2b-3fd3-43e9-9bed-b5a454ccb0c9', 'Blue Moa Moa ceviche', 'blue-mao-mao', NULL, 'Cut up fish, any fish, into cubes. 
Cover with lemon juice, any citrus works. Leave overnight until meal time in the fridge. 
Drain thoroughly, then add coconut cream, sweet chilli sauce , lemon pepper, diced - red onion, capsicums, tomatoes, and anything else for taste. 
There are a number of coconut creams available, I prefer Fia Coconut Cream. Enjoy.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/44c0e0c9-df89-428d-bf9b-c3a1b66b135a/blue-mao-mao-1768435749959.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/44c0e0c9-df89-428d-bf9b-c3a1b66b135a/blue-mao-mao-1768435749959.jpg', '2026-01-15 00:09:11.986612+00'),
  ('67ed4d7e-2cd0-450e-aa11-177e89770880', 'Thai Massaman Kingfish Curry', 'kingfish-over-15kg', NULL, 'Follow the recipe on the back of the jar, although changes made were: half the amount of coconut cream. Added eggplant and red capsicum. Had with rice and not potatoes. And obviously fish not chicken', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/44c0e0c9-df89-428d-bf9b-c3a1b66b135a/Kingfish-1768440309939.jfif', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/44c0e0c9-df89-428d-bf9b-c3a1b66b135a/Kingfish-1768440309939.jpg', '2026-01-15 01:25:11.555936+00'),
  ('2cfdad0c-9db7-43ce-9e64-2ca0be9c1633', 'Ceviche', 'kingfish-over-15kg', NULL, 'Ingredients
	•	Fresh white fish (most will do – recommended: kingfish or trevally)
	•	Fresh lemons (or lemon juice)
	•	Capsicum, finely diced
	•	Fresh chilli, finely chopped
	•	Red onion, finely diced
	•	Cucumber, diced
	•	Tomato, diced
	•	Coriander (fresh), chopped
	•	Coconut cream
	•	Salt and pepper
	•	Corn chips, to serve

⸻

Method
	1.	Prepare the fish
Juice the lemons. Cut the fish into 1cm cubes and place in a bowl. Pour over enough lemon juice to fully coat the fish.
Cover and refrigerate for about 20 minutes, mixing a couple of times to ensure the lemon juice evenly “cooks” the fish.
	2.	Prepare the vegetables
While the fish is in the fridge, finely dice all the vegetables and chop the coriander.
	3.	Combine
Remove the fish from the fridge and drain off the excess lemon juice (or transfer the fish to a clean bowl).
Add the diced vegetables and coriander. Pour in the coconut cream.
	4.	Season & chill
Season generously with salt and pepper. Mix well.
For best flavour, refrigerate for another 20 minutes before serving.
	5.	Serve
Serve chilled with corn chips.

⸻

💡 Tip: It keeps well for a day or so in the fridge, so don’t be shy about making a big batch for leftovers, Enjoy!', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/c6ba52ff-1da7-4d98-81aa-c788b02c6bd9/Kingfish-1772414260056.jpeg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/c6ba52ff-1da7-4d98-81aa-c788b02c6bd9/Kingfish-1772414260056.jpg', '2026-03-02 01:17:42.046706+00'),
  ('d5aee6ee-6ed5-4eb5-b8a2-e119e584c724', 'Ukha', 'snapper', 'https://share.google/HU6Nk6tCwMV2efyAK', NULL, 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/71c10144-aa7e-4452-86f8-97cef055072f/snapper-1772947025152.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/71c10144-aa7e-4452-86f8-97cef055072f/snapper-1772947025152.jpg', '2026-03-08 05:17:10.030871+00'),
  ('46bc34f8-5c90-4d8c-b5c9-d3d776b7404e', 'Smoked caviar', 'kingfish-over-15kg', 'https://share.google/n9SlGcYJ6d1r30oNv', 'Smoked kingfish caviar is delicious, do not waste it by throwing away.
Go to a smokehouse if you don''t want to smoke yourself or just follow the recipe in url for recipe.', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/71c10144-aa7e-4452-86f8-97cef055072f/Kingfish-1772947331694.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/71c10144-aa7e-4452-86f8-97cef055072f/Kingfish-1772947331694.jpg', '2026-03-08 05:22:14.181675+00'),
  ('c830fd63-7658-4143-8b9d-c1a00b7f9df1', 'Fish balls', 'kingfish-over-15kg', 'https://openkitchen.eda.yandex/article/dishes/recipes/kak-prigotovit-idealnye-rybnye-kotlety-sekrety-i-retsepty', 'Ingredients
500 g fish mince (any white fish, I prefer kingfish, great for frozen as well)
1 egg
1 small onion
2–3 tbsp breadcrumbs (or soaked bread)
1–2 tbsp milk or water
Salt
Black pepper
Oil for frying
Optional:
Garlic
Fresh dill or parsley
Step-by-step
1. Prepare the bread
Put breadcrumbs or bread in a bowl.
Add milk or water.
Let it soak for 2 minutes.
2. Mix the mince
In a bowl combine:
Fish mince
Butter
Egg
Finely chopped onion
Soaked bread
Salt and pepper
Mix everything very well until it becomes sticky.
Tip: if mixture is too wet → add more breadcrumbs.
3. Shape the patties
Wet your hands with water.
Take a small portion of mixture.
Form oval or round patties about 2–3 cm thick.
Optional: roll them in extra breadcrumbs for a crispy crust.
4. Fry
Heat oil in a pan on medium heat.
Place patties in the pan.
Fry 4–5 minutes per side until golden brown.
5. Finish cooking
Turn heat to low, cover the pan, and cook another 5 minutes so the inside cooks fully.

All done!', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/71c10144-aa7e-4452-86f8-97cef055072f/Kingfish-1772947684924.jpg', 'https://hwbfxsnahyvlyarupfwe.supabase.co/storage/v1/object/public/fish-uploads/dishes/thumbs/71c10144-aa7e-4452-86f8-97cef055072f/Kingfish-1772947684924.jpg', '2026-03-08 05:28:08.777774+00')
ON CONFLICT (id) DO NOTHING;
