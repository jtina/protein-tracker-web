/* Recipe nutrition: a small built-in food table, an ingredient-line parser, and the math
   that turns a recipe's ingredient list into protein and calories per serving. */
(function (root) {
  'use strict';

  // Per 100 g: p = protein (g), c = calories (kcal). Weights in grams: cup = one cup,
  // each = one piece (egg, banana, clove, slice, scoop...), can = one can, stick = one stick.
  // Values are typical USDA figures; meats and grains are raw/dry unless the name says cooked.
  // k = names it's found by (the longest matching name wins, so "peanut butter" beats "butter").
  const FOODS = [
    // Poultry, meat, fish (raw)
    { id: 'chicken-breast', n: 'Chicken breast', k: ['chicken breast', 'chicken breasts', 'chicken tenders', 'chicken tenderloins'], p: 22.5, c: 120, cup: 140, each: 174, cooked: 'chicken-cooked' },
    { id: 'chicken-thigh', n: 'Chicken thigh', k: ['chicken thigh', 'chicken thighs'], p: 19.7, c: 144, each: 115, cooked: 'chicken-cooked' },
    { id: 'chicken', n: 'Chicken', k: ['chicken'], p: 21, c: 140, cup: 140, each: 174, cooked: 'chicken-cooked' },
    { id: 'chicken-cooked', n: 'Chicken, cooked', k: ['cooked chicken', 'shredded chicken', 'rotisserie chicken', 'grilled chicken'], p: 27, c: 190, cup: 140 },
    { id: 'ground-chicken', n: 'Ground chicken', k: ['ground chicken'], p: 17.4, c: 143, cup: 225 },
    { id: 'ground-turkey', n: 'Ground turkey', k: ['ground turkey', 'turkey mince'], p: 18.7, c: 150, cup: 225 },
    { id: 'turkey-breast', n: 'Turkey breast', k: ['turkey breast', 'turkey'], p: 23.7, c: 114, cup: 140 },
    { id: 'turkey-bacon', n: 'Turkey bacon', k: ['turkey bacon'], p: 15, c: 220, each: 15 },
    { id: 'chicken-sausage', n: 'Chicken sausage', k: ['chicken sausage', 'chicken sausages', 'turkey sausage'], p: 14, c: 170, each: 85 },
    { id: 'deli-turkey', n: 'Deli turkey', k: ['deli turkey', 'sliced turkey', 'turkey slices'], p: 17, c: 100, each: 28 },
    { id: 'ground-beef', n: 'Ground beef (80/20)', k: ['ground beef', 'minced beef', 'beef mince', 'hamburger'], p: 17.2, c: 254, cup: 225 },
    { id: 'lean-ground-beef', n: 'Lean ground beef (90/10)', k: ['lean ground beef', 'extra lean ground beef', '90% lean ground beef', '93% lean ground beef'], p: 20, c: 176, cup: 225 },
    { id: 'steak', n: 'Beef steak', k: ['steak', 'sirloin', 'beef', 'flank steak', 'ribeye', 'stew meat', 'beef chuck'], p: 21, c: 160, cup: 150, each: 225 },
    { id: 'pork-tenderloin', n: 'Pork tenderloin', k: ['pork tenderloin', 'pork loin', 'pork'], p: 21, c: 120, each: 450 },
    { id: 'pork-chop', n: 'Pork chop', k: ['pork chop', 'pork chops'], p: 21, c: 170, each: 150 },
    { id: 'ground-pork', n: 'Ground pork', k: ['ground pork', 'pork mince'], p: 16.9, c: 263, cup: 225 },
    { id: 'bacon', n: 'Bacon', k: ['bacon'], p: 12, c: 417, each: 26 },
    { id: 'ham', n: 'Ham', k: ['ham'], p: 16.7, c: 145, cup: 140, each: 28 },
    { id: 'sausage', n: 'Sausage', k: ['sausage', 'sausages', 'italian sausage', 'chorizo'], p: 14, c: 300, each: 75 },
    { id: 'salmon', n: 'Salmon', k: ['salmon'], p: 20.4, c: 208, each: 170 },
    { id: 'tuna-canned', n: 'Tuna, canned in water', k: ['tuna', 'canned tuna', 'tuna in water'], p: 23.6, c: 116, cup: 154, can: 120 },
    { id: 'tuna-steak', n: 'Tuna steak', k: ['tuna steak', 'ahi tuna', 'fresh tuna'], p: 23.3, c: 109, each: 170 },
    { id: 'shrimp', n: 'Shrimp', k: ['shrimp', 'prawns', 'prawn'], p: 20.1, c: 85, cup: 145, each: 12 },
    { id: 'white-fish', n: 'White fish (cod, tilapia)', k: ['cod', 'tilapia', 'white fish', 'whitefish', 'halibut', 'haddock', 'fish'], p: 19, c: 90, each: 170 },
    // Plant protein
    { id: 'tofu', n: 'Tofu, firm', k: ['tofu', 'firm tofu', 'extra firm tofu', 'extra-firm tofu'], p: 17.3, c: 144, cup: 252, each: 397 },
    { id: 'silken-tofu', n: 'Tofu, silken', k: ['silken tofu', 'soft tofu'], p: 4.8, c: 55, cup: 248, each: 340 },
    { id: 'tempeh', n: 'Tempeh', k: ['tempeh'], p: 20.3, c: 192, cup: 166, each: 227 },
    { id: 'seitan', n: 'Seitan', k: ['seitan'], p: 25, c: 140, cup: 140 },
    { id: 'vital-wheat-gluten', n: 'Vital wheat gluten', k: ['vital wheat gluten', 'wheat gluten'], p: 75, c: 370, cup: 120 },
    { id: 'protein-powder', n: 'Protein powder', k: ['protein powder', 'whey protein', 'whey', 'protein isolate', 'casein'], p: 77, c: 387, cup: 90, each: 31 },
    { id: 'nutritional-yeast', n: 'Nutritional yeast', k: ['nutritional yeast', 'nooch'], p: 50, c: 380, cup: 80 },
    // Eggs and dairy
    { id: 'egg', n: 'Egg', k: ['egg', 'eggs', 'whole egg', 'whole eggs'], p: 12.6, c: 143, cup: 243, each: 50, large: true },
    { id: 'egg-white', n: 'Egg white', k: ['egg white', 'egg whites', 'liquid egg whites'], p: 10.9, c: 52, cup: 243, each: 33, large: true },
    { id: 'egg-yolk', n: 'Egg yolk', k: ['egg yolk', 'egg yolks'], p: 15.9, c: 322, each: 17, large: true },
    { id: 'milk', n: 'Milk (2%)', k: ['milk', '2% milk', 'reduced fat milk'], p: 3.3, c: 50, cup: 244 },
    { id: 'whole-milk', n: 'Whole milk', k: ['whole milk'], p: 3.2, c: 61, cup: 244 },
    { id: 'protein-milk', n: 'Ultra-filtered milk (Fairlife)', k: ['fairlife', 'fairlife milk', 'ultra filtered milk', 'ultrafiltered milk', 'protein milk'], p: 5.4, c: 46, cup: 240 },
    { id: 'skim-milk', n: 'Skim milk', k: ['skim milk', 'nonfat milk', 'fat free milk'], p: 3.4, c: 34, cup: 245 },
    { id: 'greek-yogurt', n: 'Greek yogurt, plain', k: ['greek yogurt', 'greek yoghurt', 'skyr', 'quark', 'protein yogurt', 'high protein yogurt'], p: 10, c: 73, cup: 245 },
    { id: 'yogurt', n: 'Yogurt, plain', k: ['yogurt', 'yoghurt', 'plain yogurt'], p: 3.5, c: 61, cup: 245 },
    { id: 'cottage-cheese', n: 'Cottage cheese', k: ['cottage cheese'], p: 10.5, c: 81, cup: 226 },
    { id: 'cheddar', n: 'Cheddar cheese', k: ['cheddar', 'cheddar cheese', 'cheese', 'shredded cheese', 'mexican cheese', 'colby jack', 'monterey jack', 'swiss cheese'], p: 23.3, c: 409, cup: 113, each: 28 },
    { id: 'light-cheese', n: 'Reduced-fat cheese', k: ['reduced fat cheese', 'low fat cheese', 'light cheese', 'lighter cheese', 'reduced fat cheddar', 'light mozzarella', 'low fat mozzarella', 'cheese slices light'], p: 27, c: 280, cup: 113, each: 21 },
    { id: 'mozzarella', n: 'Mozzarella (part skim)', k: ['mozzarella', 'mozzarella cheese'], p: 24, c: 254, cup: 112, each: 28 },
    { id: 'parmesan', n: 'Parmesan', k: ['parmesan', 'parmesan cheese', 'parmigiano', 'pecorino'], p: 35.8, c: 392, cup: 100 },
    { id: 'feta', n: 'Feta', k: ['feta', 'feta cheese', 'goat cheese'], p: 14.2, c: 264, cup: 150 },
    { id: 'cream-cheese', n: 'Cream cheese', k: ['cream cheese'], p: 6.2, c: 350, cup: 232 },
    { id: 'ricotta', n: 'Ricotta', k: ['ricotta', 'ricotta cheese'], p: 11.3, c: 174, cup: 246 },
    { id: 'butter', n: 'Butter', k: ['butter', 'unsalted butter', 'salted butter'], p: 0.9, c: 717, cup: 227, stick: 113 },
    { id: 'heavy-cream', n: 'Heavy cream', k: ['heavy cream', 'heavy whipping cream', 'whipping cream', 'double cream', 'cream'], p: 2.8, c: 340, cup: 238 },
    { id: 'half-and-half', n: 'Half and half', k: ['half and half', 'half & half', 'half-and-half'], p: 3.1, c: 131, cup: 242 },
    { id: 'sour-cream', n: 'Sour cream', k: ['sour cream'], p: 2.4, c: 198, cup: 230 },
    // Legumes, nuts, seeds
    { id: 'black-beans', n: 'Black beans, cooked/canned', k: ['black beans', 'black bean'], p: 8.9, c: 132, cup: 172, can: 240 },
    { id: 'chickpeas', n: 'Chickpeas, cooked/canned', k: ['chickpeas', 'chickpea', 'garbanzo beans', 'garbanzo'], p: 8.9, c: 164, cup: 164, can: 240 },
    { id: 'kidney-beans', n: 'Kidney beans, cooked/canned', k: ['kidney beans', 'red kidney beans'], p: 8.7, c: 127, cup: 177, can: 240 },
    { id: 'pinto-beans', n: 'Pinto beans, cooked/canned', k: ['pinto beans', 'refried beans'], p: 9, c: 143, cup: 171, can: 240 },
    { id: 'white-beans', n: 'White beans, cooked/canned', k: ['white beans', 'cannellini beans', 'navy beans', 'great northern beans', 'beans'], p: 9.7, c: 139, cup: 179, can: 240 },
    { id: 'lentils', n: 'Lentils, dry', k: ['lentils', 'lentil', 'red lentils', 'green lentils', 'brown lentils', 'split peas'], p: 24.6, c: 352, cup: 192, cooked: 'lentils-cooked' },
    { id: 'lentils-cooked', n: 'Lentils, cooked', k: ['cooked lentils', 'canned lentils'], p: 9, c: 116, cup: 198, can: 240 },
    { id: 'edamame', n: 'Edamame, shelled', k: ['edamame'], p: 11.9, c: 121, cup: 155 },
    { id: 'peanut-butter', n: 'Peanut butter', k: ['peanut butter', 'pb'], p: 25, c: 588, cup: 258 },
    { id: 'peanut-butter-powder', n: 'Powdered peanut butter', k: ['powdered peanut butter', 'pb2', 'peanut butter powder'], p: 45, c: 410, cup: 96 },
    { id: 'almond-butter', n: 'Almond butter', k: ['almond butter'], p: 21, c: 614, cup: 250 },
    { id: 'peanuts', n: 'Peanuts', k: ['peanuts', 'peanut'], p: 25.8, c: 567, cup: 146 },
    { id: 'almonds', n: 'Almonds', k: ['almonds', 'almond', 'sliced almonds', 'slivered almonds'], p: 21.2, c: 579, cup: 143, each: 1.2 },
    { id: 'walnuts', n: 'Walnuts', k: ['walnuts', 'walnut', 'pecans', 'pecan'], p: 15.2, c: 654, cup: 117 },
    { id: 'cashews', n: 'Cashews', k: ['cashews', 'cashew', 'pistachios'], p: 18.2, c: 553, cup: 137 },
    { id: 'chia', n: 'Chia seeds', k: ['chia seeds', 'chia seed', 'chia'], p: 16.5, c: 486, cup: 170 },
    { id: 'hemp', n: 'Hemp seeds', k: ['hemp seeds', 'hemp hearts', 'hemp seed'], p: 31.6, c: 553, cup: 160 },
    { id: 'flax', n: 'Flaxseed', k: ['flaxseed', 'flax seed', 'flax seeds', 'ground flaxseed', 'flax meal', 'flax'], p: 18.3, c: 534, cup: 112 },
    { id: 'pumpkin-seeds', n: 'Pumpkin seeds', k: ['pumpkin seeds', 'pepitas'], p: 30, c: 559, cup: 129 },
    { id: 'sunflower-seeds', n: 'Sunflower seeds', k: ['sunflower seeds'], p: 20.8, c: 584, cup: 140 },
    { id: 'sesame-seeds', n: 'Sesame seeds', k: ['sesame seeds', 'sesame seed'], p: 17.7, c: 573, cup: 144, each: 0.5 },
    // Grains, bread, pasta (dry unless cooked)
    { id: 'rice', n: 'Rice, dry', k: ['rice', 'white rice', 'jasmine rice', 'basmati rice', 'sushi rice', 'arborio rice'], p: 7.1, c: 365, cup: 185, cooked: 'rice-cooked' },
    { id: 'rice-cooked', n: 'Rice, cooked', k: ['cooked rice', 'cooked white rice', 'leftover rice', 'steamed rice'], p: 2.7, c: 130, cup: 158 },
    { id: 'brown-rice', n: 'Brown rice, dry', k: ['brown rice'], p: 7.9, c: 370, cup: 190, cooked: 'brown-rice-cooked' },
    { id: 'brown-rice-cooked', n: 'Brown rice, cooked', k: ['cooked brown rice'], p: 2.7, c: 123, cup: 195 },
    { id: 'quinoa', n: 'Quinoa, dry', k: ['quinoa'], p: 14.1, c: 368, cup: 170, cooked: 'quinoa-cooked' },
    { id: 'quinoa-cooked', n: 'Quinoa, cooked', k: ['cooked quinoa'], p: 4.4, c: 120, cup: 185 },
    { id: 'oats', n: 'Oats, dry', k: ['oats', 'rolled oats', 'oatmeal', 'old fashioned oats', 'quick oats', 'steel cut oats'], p: 13.2, c: 379, cup: 81 },
    { id: 'pasta', n: 'Pasta, dry', k: ['pasta', 'spaghetti', 'penne', 'macaroni', 'fettuccine', 'linguine', 'rigatoni', 'fusilli', 'rotini', 'orzo', 'lasagna noodles', 'noodles', 'ramen noodles', 'udon', 'soba'], p: 13, c: 371, cup: 100, cooked: 'pasta-cooked' },
    { id: 'pasta-cooked', n: 'Pasta, cooked', k: ['cooked pasta', 'cooked spaghetti', 'cooked noodles'], p: 5.8, c: 158, cup: 140 },
    { id: 'rice-noodles', n: 'Rice noodles, dry', k: ['rice noodles', 'rice noodle', 'rice vermicelli', 'vermicelli', 'pad thai noodles', 'flat rice noodles', 'wide rice noodles', 'pho noodles', 'glass noodles', 'cellophane noodles'], p: 6, c: 364, cup: 90, cooked: 'rice-noodles-cooked' },
    { id: 'rice-noodles-cooked', n: 'Rice noodles, cooked', k: ['cooked rice noodles'], p: 1.8, c: 108, cup: 176 },
    { id: 'protein-pasta', n: 'Protein pasta, dry', k: ['protein pasta', 'chickpea pasta', 'lentil pasta', 'banza'], p: 22, c: 350, cup: 100 },
    { id: 'egg-noodles', n: 'Egg noodles, dry', k: ['egg noodles'], p: 14.2, c: 384, cup: 38 },
    { id: 'couscous', n: 'Couscous, dry', k: ['couscous'], p: 12.8, c: 376, cup: 173 },
    { id: 'flour', n: 'All-purpose flour', k: ['flour', 'all purpose flour', 'all-purpose flour', 'plain flour', 'bread flour', 'self rising flour'], p: 10.3, c: 364, cup: 125 },
    { id: 'wheat-flour', n: 'Whole wheat flour', k: ['whole wheat flour', 'wholemeal flour'], p: 13.2, c: 340, cup: 120 },
    { id: 'almond-flour', n: 'Almond flour', k: ['almond flour', 'almond meal'], p: 21, c: 590, cup: 112 },
    { id: 'bread', n: 'Bread', k: ['bread', 'white bread', 'sourdough', 'sourdough bread', 'toast'], p: 9, c: 266, each: 28 },
    { id: 'wheat-bread', n: 'Whole wheat bread', k: ['whole wheat bread', 'whole grain bread', 'wheat bread', 'multigrain bread'], p: 12.5, c: 252, each: 32 },
    { id: 'tortilla', n: 'Flour tortilla', k: ['tortilla', 'tortillas', 'flour tortilla', 'flour tortillas', 'wrap', 'wraps'], p: 8.2, c: 304, each: 45 },
    { id: 'corn-tortilla', n: 'Corn tortilla', k: ['corn tortilla', 'corn tortillas'], p: 5.7, c: 218, each: 26 },
    { id: 'bagel', n: 'Bagel', k: ['bagel', 'bagels'], p: 10, c: 257, each: 105 },
    { id: 'buns', n: 'Bun', k: ['bun', 'buns', 'hamburger buns', 'english muffin', 'english muffins', 'pita', 'pita bread', 'naan'], p: 9, c: 270, each: 60 },
    { id: 'breadcrumbs', n: 'Breadcrumbs', k: ['breadcrumbs', 'bread crumbs', 'panko'], p: 13.4, c: 395, cup: 108 },
    { id: 'granola', n: 'Granola', k: ['granola'], p: 10, c: 471, cup: 122 },
    // Vegetables
    { id: 'broccoli', n: 'Broccoli', k: ['broccoli', 'broccoli florets', 'broccolini', 'tenderstem broccoli'], p: 2.8, c: 34, cup: 91, each: 225 },
    { id: 'chinese-broccoli', n: 'Chinese broccoli (gai lan)', k: ['chinese broccoli', 'gai lan', 'kai lan', 'choy sum', 'yu choy'], p: 1.2, c: 22, cup: 88 },
    { id: 'spinach', n: 'Spinach', k: ['spinach', 'baby spinach'], p: 2.9, c: 23, cup: 30 },
    { id: 'kale', n: 'Kale', k: ['kale'], p: 2.9, c: 35, cup: 21 },
    { id: 'lettuce', n: 'Lettuce', k: ['lettuce', 'romaine', 'mixed greens', 'arugula', 'salad greens'], p: 1.2, c: 17, cup: 47 },
    { id: 'onion', n: 'Onion', k: ['onion', 'onions', 'red onion', 'yellow onion', 'white onion', 'shallot', 'shallots'], p: 1.1, c: 40, cup: 160, each: 110 },
    { id: 'green-onion', n: 'Green onion', k: ['green onion', 'green onions', 'scallion', 'scallions', 'spring onion', 'spring onions', 'chives'], p: 1.8, c: 32, cup: 100, each: 15 },
    { id: 'garlic', n: 'Garlic', k: ['garlic', 'garlic cloves', 'garlic clove', 'minced garlic'], p: 6.4, c: 149, cup: 136, each: 3 },
    { id: 'ginger', n: 'Ginger', k: ['ginger', 'fresh ginger'], p: 1.8, c: 80, cup: 96, each: 15 },
    { id: 'tomato', n: 'Tomato', k: ['tomato', 'tomatoes', 'cherry tomatoes', 'grape tomatoes', 'roma tomatoes'], p: 0.9, c: 18, cup: 180, each: 123 },
    { id: 'canned-tomatoes', n: 'Canned tomatoes', k: ['canned tomatoes', 'diced tomatoes', 'crushed tomatoes', 'whole peeled tomatoes', 'fire roasted tomatoes'], p: 1.2, c: 25, cup: 240, can: 411 },
    { id: 'tomato-sauce', n: 'Tomato sauce', k: ['tomato sauce', 'marinara', 'marinara sauce', 'pasta sauce', 'passata'], p: 1.4, c: 40, cup: 245, can: 425 },
    { id: 'tomato-paste', n: 'Tomato paste', k: ['tomato paste'], p: 4.3, c: 82, cup: 262, can: 170 },
    { id: 'bell-pepper', n: 'Bell pepper', k: ['bell pepper', 'bell peppers', 'red pepper', 'green pepper', 'yellow pepper', 'red bell pepper', 'green bell pepper', 'capsicum'], p: 1, c: 26, cup: 149, each: 120 },
    { id: 'jalapeno', n: 'Jalapeño', k: ['jalapeno', 'jalapeño', 'jalapenos', 'chili pepper', 'chilli', 'serrano'], p: 0.9, c: 29, cup: 90, each: 14 },
    { id: 'carrot', n: 'Carrot', k: ['carrot', 'carrots', 'baby carrots'], p: 0.9, c: 41, cup: 128, each: 61 },
    { id: 'celery', n: 'Celery', k: ['celery', 'celery stalks', 'celery stalk'], p: 0.7, c: 14, cup: 101, each: 40 },
    { id: 'potato', n: 'Potato', k: ['potato', 'potatoes', 'russet potatoes', 'yukon gold potatoes', 'red potatoes', 'baby potatoes'], p: 2, c: 77, cup: 150, each: 213 },
    { id: 'sweet-potato', n: 'Sweet potato', k: ['sweet potato', 'sweet potatoes', 'yam', 'yams'], p: 1.6, c: 86, cup: 133, each: 130 },
    { id: 'mushrooms', n: 'Mushrooms', k: ['mushrooms', 'mushroom', 'cremini mushrooms', 'button mushrooms', 'shiitake'], p: 3.1, c: 22, cup: 70, each: 18 },
    { id: 'zucchini', n: 'Zucchini', k: ['zucchini', 'courgette', 'squash', 'yellow squash'], p: 1.2, c: 17, cup: 124, each: 196 },
    { id: 'cucumber', n: 'Cucumber', k: ['cucumber', 'cucumbers'], p: 0.7, c: 15, cup: 119, each: 300 },
    { id: 'cauliflower', n: 'Cauliflower', k: ['cauliflower', 'cauliflower rice', 'riced cauliflower'], p: 1.9, c: 25, cup: 107, each: 575 },
    { id: 'green-beans', n: 'Green beans', k: ['green beans', 'string beans'], p: 1.8, c: 31, cup: 110 },
    { id: 'peas', n: 'Green peas', k: ['peas', 'green peas', 'frozen peas'], p: 5.4, c: 81, cup: 145 },
    { id: 'corn', n: 'Corn', k: ['corn', 'sweet corn', 'corn kernels'], p: 3.3, c: 86, cup: 154, each: 90, can: 250 },
    { id: 'avocado', n: 'Avocado', k: ['avocado', 'avocados', 'guacamole'], p: 2, c: 160, cup: 150, each: 136 },
    { id: 'cabbage', n: 'Cabbage', k: ['cabbage', 'coleslaw mix', 'bok choy'], p: 1.3, c: 25, cup: 89 },
    { id: 'asparagus', n: 'Asparagus', k: ['asparagus'], p: 2.2, c: 20, cup: 134, each: 16 },
    { id: 'eggplant', n: 'Eggplant', k: ['eggplant', 'aubergine'], p: 1, c: 25, cup: 82, each: 458 },
    { id: 'brussels', n: 'Brussels sprouts', k: ['brussels sprouts', 'brussel sprouts'], p: 3.4, c: 43, cup: 88, each: 19 },
    { id: 'pumpkin', n: 'Pumpkin purée', k: ['pumpkin', 'pumpkin puree', 'pumpkin purée', 'butternut squash'], p: 1.1, c: 34, cup: 245, can: 425 },
    { id: 'herbs', n: 'Fresh herbs', k: ['cilantro', 'parsley', 'basil', 'dill', 'mint', 'fresh herbs', 'rosemary', 'thyme sprigs'], p: 2.5, c: 30, cup: 16, each: 1 },
    // Fruit
    { id: 'banana', n: 'Banana', k: ['banana', 'bananas'], p: 1.1, c: 89, cup: 150, each: 118 },
    { id: 'apple', n: 'Apple', k: ['apple', 'apples'], p: 0.3, c: 52, cup: 125, each: 182 },
    { id: 'berries', n: 'Berries', k: ['berries', 'mixed berries', 'blueberries', 'raspberries', 'blackberries'], p: 0.8, c: 55, cup: 145 },
    { id: 'strawberries', n: 'Strawberries', k: ['strawberries', 'strawberry'], p: 0.7, c: 32, cup: 152, each: 12 },
    { id: 'orange', n: 'Orange', k: ['orange', 'oranges'], p: 0.9, c: 47, cup: 180, each: 131 },
    { id: 'lemon', n: 'Lemon / lime', k: ['lemon', 'lemons', 'lime', 'limes'], p: 1.1, c: 29, cup: 210, each: 60 },
    { id: 'citrus-juice', n: 'Lemon / lime juice', k: ['lemon juice', 'lime juice', 'juice of'], p: 0.4, c: 22, cup: 244, each: 30 },
    { id: 'mango', n: 'Mango', k: ['mango', 'mangoes'], p: 0.8, c: 60, cup: 165, each: 200 },
    { id: 'pineapple', n: 'Pineapple', k: ['pineapple'], p: 0.5, c: 50, cup: 165 },
    { id: 'raisins', n: 'Raisins', k: ['raisins', 'dried cranberries', 'craisins'], p: 3.1, c: 299, cup: 145 },
    { id: 'dates', n: 'Dates', k: ['dates', 'medjool dates', 'date'], p: 1.8, c: 277, cup: 147, each: 24 },
    // Oils, sauces, sweeteners, pantry
    { id: 'oil', n: 'Oil', k: ['oil', 'olive oil', 'extra virgin olive oil', 'vegetable oil', 'canola oil', 'coconut oil', 'avocado oil', 'sesame oil', 'cooking spray'], p: 0, c: 884, cup: 216 },
    { id: 'cooking-spray', n: 'Cooking spray', k: ['cooking spray', 'spray oil', 'oil spray', 'spray cooking oil', 'cooking oil spray', 'olive oil spray', 'avocado oil spray', 'nonstick spray', 'pam'], p: 0, c: 884, each: 0.3 },
    { id: 'mayo', n: 'Mayonnaise', k: ['mayonnaise', 'mayo'], p: 1, c: 680, cup: 220 },
    { id: 'light-mayo', n: 'Light mayonnaise', k: ['light mayo', 'light mayonnaise', 'lighter mayo', 'reduced fat mayo'], p: 0.9, c: 300, cup: 230 },
    { id: 'oyster-sauce', n: 'Oyster sauce', k: ['oyster sauce', 'hoisin', 'hoisin sauce', 'stir fry sauce', 'teriyaki sauce', 'teriyaki'], p: 1.4, c: 80, cup: 288 },
    { id: 'dark-soy', n: 'Dark soy sauce', k: ['dark soy sauce', 'dark soy', 'sweet soy sauce', 'kecap manis'], p: 5, c: 100, cup: 272 },
    { id: 'chili-paste', n: 'Chili paste / sauce', k: ['gochujang', 'sweet chili sauce', 'sweet chilli sauce', 'chili garlic sauce', 'sambal oelek', 'chili crisp', 'chili oil', 'curry paste', 'red curry paste', 'green curry paste', 'miso', 'miso paste'], p: 3, c: 180, cup: 270 },
    { id: 'rice-wine', n: 'Rice wine / mirin', k: ['mirin', 'shaoxing wine', 'rice wine', 'cooking wine', 'sake', 'white wine', 'red wine'], p: 0.2, c: 120, cup: 240 },
    { id: 'sweetener', n: 'Zero-calorie sweetener', k: ['sweetener', 'stevia', 'truvia', 'erythritol', 'monk fruit', 'monk fruit sweetener', 'allulose', 'splenda', 'sucralose', 'sugar free syrup', 'sugar-free syrup', 'zero calorie sweetener'], p: 0, c: 0, cup: 200, each: 1 },
    { id: 'sweetener-blend', n: 'Sweetener & sugar blend', k: ['truvia brown', 'brown truvia', 'brown sugar blend', 'truvia brown sugar blend', 'sugar blend', 'baking blend'], p: 0, c: 190, cup: 200 },
    { id: 'soy-sauce', n: 'Soy sauce', k: ['soy sauce', 'tamari', 'coconut aminos', 'fish sauce'], p: 8.1, c: 53, cup: 255 },
    { id: 'honey', n: 'Honey', k: ['honey', 'agave', 'agave nectar'], p: 0.3, c: 304, cup: 339 },
    { id: 'maple', n: 'Maple syrup', k: ['maple syrup', 'syrup'], p: 0, c: 260, cup: 315 },
    { id: 'sugar', n: 'Sugar', k: ['sugar', 'granulated sugar', 'white sugar', 'powdered sugar', 'confectioners sugar'], p: 0, c: 387, cup: 200 },
    { id: 'brown-sugar', n: 'Brown sugar', k: ['brown sugar', 'coconut sugar'], p: 0.1, c: 380, cup: 220 },
    { id: 'ketchup', n: 'Ketchup', k: ['ketchup', 'bbq sauce', 'barbecue sauce'], p: 1, c: 110, cup: 272 },
    { id: 'mustard', n: 'Mustard', k: ['mustard', 'dijon mustard', 'dijon'], p: 3.7, c: 60, cup: 250 },
    { id: 'hot-sauce', n: 'Hot sauce', k: ['hot sauce', 'sriracha', 'buffalo sauce'], p: 0.5, c: 20, cup: 250 },
    { id: 'salsa', n: 'Salsa', k: ['salsa'], p: 1.5, c: 36, cup: 259 },
    { id: 'pesto', n: 'Pesto', k: ['pesto'], p: 5, c: 420, cup: 250 },
    { id: 'hummus', n: 'Hummus', k: ['hummus'], p: 7.9, c: 166, cup: 246 },
    { id: 'tahini', n: 'Tahini', k: ['tahini'], p: 17, c: 595, cup: 240 },
    { id: 'broth', n: 'Broth / stock', k: ['broth', 'stock', 'chicken broth', 'chicken stock', 'beef broth', 'beef stock', 'vegetable broth', 'vegetable stock', 'bone broth'], p: 1, c: 6, cup: 240 },
    { id: 'coconut-milk', n: 'Coconut milk (canned)', k: ['coconut milk', 'coconut cream'], p: 2.3, c: 230, cup: 240, can: 400 },
    { id: 'almond-milk', n: 'Almond milk, unsweetened', k: ['almond milk', 'cashew milk', 'unsweetened almond milk'], p: 0.4, c: 15, cup: 240 },
    { id: 'soy-milk', n: 'Soy milk', k: ['soy milk', 'soymilk'], p: 3.3, c: 54, cup: 243 },
    { id: 'oat-milk', n: 'Oat milk', k: ['oat milk'], p: 1, c: 48, cup: 240 },
    { id: 'chocolate-chips', n: 'Chocolate chips', k: ['chocolate chips', 'chocolate', 'dark chocolate', 'chocolate chunks'], p: 4.2, c: 480, cup: 168 },
    { id: 'cocoa', n: 'Cocoa powder', k: ['cocoa powder', 'cocoa', 'cacao powder'], p: 19.6, c: 228, cup: 86 },
    { id: 'cornstarch', n: 'Cornstarch', k: ['cornstarch', 'corn starch', 'cornflour'], p: 0.3, c: 381, cup: 128 },
    { id: 'potato-starch', n: 'Potato / tapioca starch', k: ['potato starch', 'coarse potato starch', 'tapioca starch', 'tapioca flour', 'arrowroot', 'arrowroot powder', 'sweet potato starch'], p: 0.1, c: 333, cup: 192 },
    { id: 'vanilla', n: 'Vanilla extract', k: ['vanilla extract', 'vanilla'], p: 0, c: 288, cup: 208 },
    { id: 'vinegar', n: 'Vinegar', k: ['vinegar', 'apple cider vinegar', 'rice vinegar', 'rice wine vinegar', 'balsamic vinegar', 'red wine vinegar', 'white wine vinegar', 'white vinegar', 'sherry vinegar', 'malt vinegar', 'black vinegar'], p: 0, c: 18, cup: 240 },
    { id: 'spices', n: 'Spices', k: ['spices', 'cumin', 'paprika', 'smoked paprika', 'chili powder', 'chilli powder', 'cinnamon', 'oregano', 'thyme', 'turmeric', 'curry powder', 'garlic powder', 'onion powder', 'italian seasoning', 'cayenne', 'cayenne pepper', 'red pepper flakes', 'crushed red pepper', 'nutmeg', 'coriander', 'garam masala', 'taco seasoning', 'seasoning', 'bay leaves', 'bay leaf', 'black pepper', 'pepper', 'everything bagel seasoning', 'five spice', 'chinese five spice', 'five spice powder', 'white pepper', 'msg', 'chicken bouillon', 'bouillon', 'ranch seasoning', 'cajun seasoning', 'old bay', 'allspice', 'cardamom', 'cloves ground', 'sage', 'star anise', 'dried oregano', 'dried basil', 'dried thyme', 'ground ginger'], p: 10, c: 300, cup: 100, each: 0.2 },
    { id: 'salt', n: 'Salt', k: ['salt', 'kosher salt', 'sea salt', 'baking soda', 'baking powder'], p: 0, c: 0, cup: 290 },
    { id: 'water', n: 'Water', k: ['water', 'ice', 'ice cubes', 'cold water', 'warm water', 'hot water'], p: 0, c: 0, cup: 237 },
    { id: 'yeast', n: 'Yeast', k: ['yeast', 'instant yeast', 'active dry yeast'], p: 40, c: 325, cup: 140, each: 7 }
  ];

  const FOOD_BY_ID = {};
  FOODS.forEach((f) => { FOOD_BY_ID[f.id] = f; });

  // Longest names first, so the most specific match wins.
  const NAMES = [];
  FOODS.forEach((f) => f.k.forEach((k) => NAMES.push({ k: normalize(k), food: f })));
  NAMES.sort((a, b) => b.k.length - a.k.length);

  const CUP_ML = 236.6;

  // Unit words → how they convert. kind: mass (grams), vol (ml), each, can, stick.
  const UNITS = [
    [['g', 'gr', 'gram', 'grams', 'gm', 'gms'], 'mass', 1],
    [['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'], 'mass', 1000],
    [['mg', 'milligram', 'milligrams'], 'mass', 0.001],
    [['oz', 'ounce', 'ounces'], 'mass', 28.35],
    [['lb', 'lbs', 'pound', 'pounds'], 'mass', 453.6],
    [['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'cc'], 'vol', 1],
    [['l', 'liter', 'liters', 'litre', 'litres'], 'vol', 1000],
    [['dl'], 'vol', 100],
    [['fl oz', 'fluid ounce', 'fluid ounces', 'floz'], 'vol', 29.57],
    [['cup', 'cups', 'c'], 'vol', CUP_ML],
    [['tbsp', 'tbsps', 'tbs', 'tbl', 'tablespoon', 'tablespoons', 'T'], 'vol', CUP_ML / 16],
    [['tsp', 'tsps', 'teaspoon', 'teaspoons', 't'], 'vol', CUP_ML / 48],
    [['pint', 'pints', 'pt'], 'vol', CUP_ML * 2],
    [['quart', 'quarts', 'qt'], 'vol', CUP_ML * 4],
    [['pinch', 'pinches', 'dash', 'dashes'], 'vol', CUP_ML / 768],
    [['handful', 'handfuls'], 'mass', 30],
    [['sprinkle', 'sprinkles'], 'vol', CUP_ML / 96],
    [['splash', 'splashes', 'drizzle', 'drizzles', 'glug'], 'vol', CUP_ML / 48],
    [['can', 'cans', 'tin', 'tins'], 'can', 1],
    [['stick', 'sticks'], 'stick', 1],
    [['clove', 'cloves', 'slice', 'slices', 'piece', 'pieces', 'pc', 'pcs', 'whole', 'scoop', 'scoops', 'fillet', 'fillets', 'filet', 'filets', 'second', 'seconds', 'spray', 'sprays', 'spritz', 'spritzes', 'breast', 'breasts', 'thigh', 'thighs', 'stalk', 'stalks', 'sprig', 'sprigs', 'leaf', 'leaves', 'link', 'links', 'strip', 'strips', 'patty', 'patties', 'head', 'heads', 'ear', 'ears', 'bunch', 'bunches', 'package', 'packages', 'pkg', 'block', 'blocks', 'container', 'containers', 'bag', 'bags', 'jar', 'jars', 'box', 'boxes', 'serving', 'servings'], 'each', 1]
  ];
  const UNIT_MAP = {};
  UNITS.forEach(([words, kind, factor]) => words.forEach((w) => { UNIT_MAP[w] = { kind, factor, word: w }; }));
  const SIZES = { small: 0.75, medium: 1, med: 1, large: 1.25, big: 1.25, 'extra large': 1.4, 'extra-large': 1.4, xl: 1.4, jumbo: 1.5 };

  const FRACTIONS = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
  const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, half: 0.5 };

  function normalize(s) {
    return String(s).toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9%\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Reads one number at the start of s: "1", "1.5", "1,5", "1/2", "1 1/2", "1½", "½".
  const NUM = '(?:\\d+(?:[.,]\\d+)?\\s*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+|\\d+(?:[.,]\\d+)?|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])';
  function numValue(s) {
    s = s.trim();
    let m = s.match(/^(\d+(?:[.,]\d+)?)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
    if (m) return parseFloat(m[1].replace(',', '.')) + FRACTIONS[m[2]];
    m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (m) return +m[1] + (+m[3] ? +m[2] / +m[3] : 0);
    m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) return +m[2] ? +m[1] / +m[2] : NaN;
    if (FRACTIONS[s] !== undefined) return FRACTIONS[s];
    return parseFloat(s.replace(',', '.'));
  }

  function readQuantity(s) {
    // A range like "2-3" or "2 to 3" counts as the middle.
    let m = s.match(new RegExp('^(' + NUM + ')\\s*(?:-|–|—|to|or)\\s*(' + NUM + ')(?![\\d/])'));
    if (m) return { qty: (numValue(m[1]) + numValue(m[2])) / 2, rest: s.slice(m[0].length) };
    m = s.match(new RegExp('^(' + NUM + ')(?![\\d/])'));
    if (m) return { qty: numValue(m[1]), rest: s.slice(m[0].length) };
    m = s.match(/^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half)\b(?:\s+dozen\b)?/i);
    if (m) {
      const dozen = /dozen/i.test(m[0]) ? 12 : 1;
      return { qty: NUMBER_WORDS[m[1].toLowerCase()] * dozen, rest: s.slice(m[0].length), word: true };
    }
    m = s.match(/^dozen\b/i);
    if (m) return { qty: 12, rest: s.slice(m[0].length), word: true };
    return null;
  }

  function readUnit(s) {
    const t = s.replace(/^\s*\.?\s*/, '');
    // Two-word units first ("fl oz", "fluid ounces").
    let m = t.match(/^(fl\.?\s*oz\.?|fluid\s+ounces?)(?![a-z])/i);
    if (m) return { unit: UNIT_MAP['fl oz'], rest: t.slice(m[0].length) };
    m = t.match(/^([a-zA-Z]+)\.?(?![a-zA-Z])/);
    if (!m) return null;
    const word = m[1];
    // Case matters only for the one-letter T (tablespoon) vs t (teaspoon).
    const u = word.length === 1 ? UNIT_MAP[word] : UNIT_MAP[word.toLowerCase()];
    if (!u) return null;
    // "c" and "t" alone only count as units when a word follows ("1 c milk"), not "1 t-bone".
    return { unit: u, rest: t.slice(m[0].length) };
  }

  /** Splits an ingredient line into quantity, unit, size word and the food text. */
  function parseLine(raw) {
    let s = String(raw || '')
      .replace(/^\s*(?:[-*•·▢□☐◦‣>]+|\d+[.)](?=\s))\s*/, '') // list bullets or "1." numbering
      .replace(/\s+/g, ' ')
      .trim();
    // "Juice of 1 lemon" → "1 lemon juice".
    s = s.replace(/^(?:the\s+)?juice\s+(?:of|from)\s+(\S+(?:\s+\d+\/\d+)?)\s+(lemons?|limes?|oranges?)\b/i, (_, n, fruit) => n + ' ' + fruit.replace(/s$/i, '') + ' juice');
    const out = { text: s, qty: null, unit: null, size: 1, pkg: null, food: s, optional: false, toTaste: false };
    if (!s) return out;
    out.optional = /\boptional\b/i.test(s);
    out.toTaste = /\b(to taste|as needed|for serving|for garnish|to garnish)\b/i.test(s);

    let q = readQuantity(s);
    // "pinch of salt", "splash of milk": one of that unit.
    if (!q && /^(?:a\s+)?(pinch|dash|sprinkle|splash|drizzle|handful|glug)\b/i.test(s)) q = { qty: 1, rest: s.replace(/^(?:a\s+)/i, '') };
    let rest = s;
    if (q) {
      out.qty = q.qty;
      rest = q.rest;
      // "1 (15 oz) can beans": the size in parentheses is what one can weighs.
      const pm = rest.match(new RegExp('^\\s*\\(\\s*(' + NUM + ')\\s*-?\\s*([a-zA-Z. ]+?)\\s*\\)'));
      if (pm) {
        const pu = readUnit(pm[2]);
        if (pu && (pu.unit.kind === 'mass' || pu.unit.kind === 'vol')) {
          out.pkg = { qty: numValue(pm[1]), unit: pu.unit };
          rest = rest.slice(pm[0].length);
        }
      }
      // "2 x 400g", "3x 100 g".
      const xm = rest.match(new RegExp('^\\s*[x×]\\s*(' + NUM + ')'));
      if (xm) {
        out.qty *= numValue(xm[1]);
        rest = rest.slice(xm[0].length);
      }
      const u = readUnit(rest);
      if (u) {
        out.unit = u.unit;
        rest = u.rest;
        // "1 can (15 oz) beans", "1 package (8 oz) cream cheese".
        if (!out.pkg && (u.unit.kind === 'can' || u.unit.kind === 'each' || u.unit.kind === 'stick')) {
          const pk = rest.match(new RegExp('^\\s*\\(\\s*(' + NUM + ')\\s*-?\\s*([a-zA-Z. ]+?)\\s*\\)'));
          const pku = pk && readUnit(pk[2]);
          if (pku && (pku.unit.kind === 'mass' || pku.unit.kind === 'vol')) {
            out.pkg = { qty: numValue(pk[1]), unit: pku.unit };
            rest = rest.slice(pk[0].length);
          }
        }
      }
      // "200g" right after the number is handled above; "of" often follows ("2 cups of milk").
    }
    rest = rest.replace(/^\s*(?:of\s+)?/i, '');
    const sm = rest.match(/^(extra[- ]large|small|medium|med|large|big|xl|jumbo)\b\s*/i);
    if (sm) {
      out.size = SIZES[sm[1].toLowerCase()] || 1;
      out.sizeWord = sm[1].toLowerCase();
      rest = rest.slice(sm[0].length);
      // "1 large can tomatoes" / "2 medium cloves garlic".
      if (out.unit === null) {
        const u = readUnit(rest);
        if (u) {
          out.unit = u.unit;
          rest = u.rest;
        }
      }
    }
    out.food = rest.trim();
    return out;
  }

  function matchFood(text) {
    const t = ' ' + normalize(text) + ' ';
    for (const n of NAMES) {
      // Whole words, allowing a plural "s"/"es".
      const i = t.indexOf(' ' + n.k);
      if (i < 0) continue;
      const after = t.slice(i + 1 + n.k.length);
      if (/^(s|es)?\s/.test(after)) return n.food;
    }
    return null;
  }

  function isHeading(line) {
    const t = line.trim();
    if (!t) return true;
    if (/:$/.test(t) && !/\d/.test(t)) return true;
    if (/^#+\s/.test(t)) return true;
    if (/^(for the|ingredients?|instructions?|directions?|method|notes?|topping|toppings|sauce|dressing|marinade|garnish)\b[^\d]*$/i.test(t) && t.length < 40) return true;
    return false;
  }

  /**
   * Nutrition for one ingredient line. ov is an optional manual fix for that line:
   * { foodId } a different built-in food, { custom: {name, p, c, each} } a food looked up
   * online (per 100 g), { grams } its weight, { manual: {protein, kcal} } totals typed in.
   */
  function analyzeLine(line, ov) {
    const parsed = parseLine(line);
    const base = { line: line, parsed: parsed, protein: 0, kcal: 0, grams: null, food: null, status: 'ok', note: '' };
    if (isHeading(line)) return Object.assign(base, { status: 'skip' });

    ov = ov || {};
    if (ov.manual) {
      return Object.assign(base, {
        protein: Math.max(0, +ov.manual.protein || 0),
        kcal: Math.max(0, +ov.manual.kcal || 0),
        food: { n: 'Entered by you' },
        status: 'manual'
      });
    }

    const food = ov.custom ? Object.assign({ id: 'custom', n: ov.custom.name, k: [] }, ov.custom) : (ov.foodId && FOOD_BY_ID[ov.foodId]) || matchFood(parsed.food) || matchFood(parsed.text);
    if (!food) return Object.assign(base, { status: 'unmatched', note: 'Not in the food list' });

    let chosen = food;
    // "1 cup rice, cooked" means cooked rice; "50g dry rice noodles, cooked" was weighed dry.
    if (!ov.foodId && !ov.custom && food.cooked && /\bcooked\b/i.test(parsed.text) && !/\b(dry|dried|uncooked|raw)\b/i.test(parsed.text)) chosen = FOOD_BY_ID[food.cooked] || food;

    let grams = ov.grams != null ? +ov.grams : null;
    let estimate = false;
    if (grams == null) {
      const g = toGrams(parsed, chosen);
      grams = g.grams;
      estimate = g.estimate;
      if (grams == null) {
        const pinch = ['salt', 'spices', 'water', 'herbs', 'cooking-spray'].indexOf(chosen.id) >= 0;
        if ((parsed.toTaste || parsed.optional || pinch) && parsed.qty == null) return Object.assign(base, { food: chosen, status: 'skip', note: 'To taste' });
        return Object.assign(base, { food: chosen, status: 'noamount', note: g.why || 'Add an amount' });
      }
    }
    return Object.assign(base, {
      food: chosen,
      grams: grams,
      protein: (chosen.p * grams) / 100,
      kcal: (chosen.c * grams) / 100,
      status: estimate ? 'estimate' : 'ok',
      note: estimate ? 'Estimated weight' : ''
    });
  }

  function toGrams(parsed, food) {
    if (parsed.qty == null) return { grams: null, why: 'Add an amount' };
    const qty = parsed.qty;
    if (parsed.pkg) {
      const one = parsed.pkg.unit.kind === 'mass' ? parsed.pkg.qty * parsed.pkg.unit.factor : volToGrams(parsed.pkg.qty * parsed.pkg.unit.factor, food).grams;
      return { grams: qty * one, estimate: parsed.pkg.unit.kind === 'vol' && !food.cup };
    }
    const u = parsed.unit;
    if (u && u.kind === 'mass') return { grams: qty * u.factor };
    if (u && u.kind === 'vol') return volToGrams(qty * u.factor, food);
    if (u && u.kind === 'can') {
      if (food.can) return { grams: qty * food.can };
      return { grams: qty * 400, estimate: true };
    }
    if (u && u.kind === 'stick') {
      if (food.stick) return { grams: qty * food.stick };
      return { grams: null, why: 'Add a weight' };
    }
    // A count: "3 eggs", "2 cloves garlic", "1 large onion".
    if (food.each) {
      // Eggs are weighed as "large"; other foods as "medium".
      const size = food.large ? (parsed.sizeWord ? parsed.size / 1.25 : 1) : parsed.size;
      return { grams: qty * food.each * size, estimate: !u && !food.large && parsed.size !== 1 };
    }
    return { grams: null, why: 'Add a unit (g, cup…)' };
  }

  function volToGrams(ml, food) {
    if (food.cup) return { grams: (ml * food.cup) / CUP_ML };
    return { grams: ml, estimate: true }; // about 1 g per ml
  }

  /** Recipe → per-line results, totals and per-serving values. */
  function analyzeRecipe(recipe) {
    const overrides = recipe.overrides || {};
    const lines = String(recipe.text || '').split(/\r?\n/);
    const items = [];
    lines.forEach((line) => {
      if (!line.trim()) return;
      items.push(analyzeLine(line, overrides[lineKey(line)]));
    });
    const total = items.reduce((t, it) => ({ protein: t.protein + it.protein, kcal: t.kcal + it.kcal }), { protein: 0, kcal: 0 });
    const servings = +recipe.servings > 0 ? +recipe.servings : 1;
    const issues = items.filter((it) => it.status === 'unmatched' || it.status === 'noamount').length;
    const weight = +recipe.weight > 0 ? +recipe.weight : null;
    return {
      items: items,
      total: total,
      servings: servings,
      perServing: { protein: total.protein / servings, kcal: total.kcal / servings, grams: weight ? weight / servings : null },
      issues: issues
    };
  }

  function lineKey(line) {
    return normalize(line);
  }

  /** Pulls a title, servings and the ingredient lines out of a pasted or uploaded recipe. */
  function extractRecipe(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    let name = '';
    let servings = null;
    const sv = String(text).match(/\b(?:serves|servings?|yield[s]?|makes|portions?)\s*[:\-]?\s*(?:about\s+)?(\d+(?:[.,]\d+)?)/i) || String(text).match(/(\d+)\s+(?:servings|portions)\b/i);
    if (sv) servings = parseFloat(sv[1].replace(',', '.'));

    let start = lines.findIndex((l) => /^\s*#*\s*ingredients?\b/i.test(l));
    let end = -1;
    if (start >= 0) {
      end = lines.findIndex((l, i) => i > start && /^\s*#*\s*(instructions?|directions?|method|steps|preparation|how to make|notes?)\b/i.test(l));
      const before = lines.slice(0, start).map((l) => l.trim()).filter(Boolean);
      if (before.length) name = before[0].replace(/^#+\s*/, '');
    } else {
      // No heading: keep lines that look like ingredients (start with an amount or bullet).
      end = lines.findIndex((l) => /^\s*#*\s*(instructions?|directions?|method|steps|preparation)\b/i.test(l));
      const first = lines.map((l) => l.trim()).find(Boolean) || '';
      if (first && !readQuantity(first.replace(/^[-*•]\s*/, '')) && first.length < 70) name = first.replace(/^#+\s*/, '');
    }
    const body = lines.slice(start >= 0 ? start + 1 : 0, end >= 0 ? end : lines.length);
    const keep = body.filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (name && t.replace(/^#+\s*/, '') === name) return false;
      if (/^(serves|servings?|yield|makes|prep time|cook time|total time|portions?)\b/i.test(t)) return false;
      return true;
    }).map((l) => l.trim());
    name = name.replace(/\s*[-–|].*recipe.*$/i, '').slice(0, 80);
    return { name: name, servings: servings, text: keep.join('\n') };
  }

  /** Open Food Facts product → a custom food (per 100 g), or null without the numbers. */
  function fromOpenFoodFacts(prod) {
    const n = prod && prod.nutriments;
    if (!n) return null;
    const p = +n.proteins_100g;
    let c = +n['energy-kcal_100g'];
    if (!Number.isFinite(c) && Number.isFinite(+n.energy_100g)) c = +n.energy_100g / 4.184;
    if (!Number.isFinite(p) || !Number.isFinite(c)) return null;
    const name = [prod.product_name, prod.brands && String(prod.brands).split(',')[0]].filter(Boolean).join(' · ').trim();
    if (!name) return null;
    const each = +prod.serving_quantity > 0 ? +prod.serving_quantity : undefined;
    return { name: name.slice(0, 80), p: Math.round(p * 10) / 10, c: Math.round(c), each: each, cup: undefined };
  }

  const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}⃣️‍]/gu;

  /**
   * A social-media caption (TikTok, Instagram) → { name, servings, text, stated }.
   * Drops hashtags, mentions, links and emojis, splits one-line ingredient lists into lines,
   * and keeps only lines that look like ingredients. `stated` is the protein / calories the
   * creator wrote in the caption, if any.
   */
  function extractFromCaption(caption) {
    let t = String(caption || '').replace(/\r/g, '');
    t = t.replace(/https?:\/\/\S+/g, ' ').replace(/(^|\s)[#@][\w.]+/gu, ' ');

    const stated = {};
    const pm = t.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?\s*(?:of\s+)?protein\b/i) ||
      t.match(/\bprotein\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g?\b/i) ||
      // "52P | 51C | 8F", "52g P"
      t.match(/(\d+(?:\.\d+)?)\s*g?\s*P\b(?=\s*(?:[|/,·•-]|\d|$|\n))/);
    if (pm) stated.protein = parseFloat(pm[1]);
    const cm = t.match(/(\d{2,4})\s*(?:kcals?|cals?|calories)\b/i) || t.match(/\b(?:calories|cals?|kcals?)\s*[:\-]?\s*(\d{2,4})\b/i);
    if (cm) stated.kcal = parseFloat(cm[1]);

    // Headings run into the line before them when the line breaks are lost ("…sweetener REMAINING: 150g…").
    t = t.replace(/\s+([A-Z][A-Za-z]*(?:\s+[A-Za-z]+)?(?:\s*\([^)]*\))?\s*:)(?=\s|$)/g, '\n$1\n');

    // Emojis and bullets often separate ingredients on one line: treat them as line breaks.
    t = t.replace(/[•·▪●◦‣]/g, '\n').replace(EMOJI, '\n');
    let lines = t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    // Still long run-on lines: split on commas / semicolons before an amount ("1 cup rice, 2 eggs").
    lines = lines.flatMap((l) => l.split(new RegExp('\\s*[,;]\\s*(?=' + NUM + '\\s*\\S|(?:a|an|one|two|three|four|half)\\s)', 'i')));
    // Sentences ("…spinach. Bake 20 min") and long comma lists ("…, salt and pepper").
    lines = lines.flatMap((l) => l.split(/(?<=[a-z)])[.!?]+\s+/i)).flatMap((l) => (l.length > 35 ? l.split(/\s*,\s*/) : [l]));
    lines = lines.map((l) => l.replace(/^[-–:*>\s]+|[\s:–-]+$/g, '').trim()).filter(Boolean);

    const name = (lines[0] && !readQuantity(lines[0]) && lines[0].length <= 70 ? lines[0] : '').replace(/[!.?]+$/, '').trim();
    const ex = extractRecipe(lines.join('\n'));
    const looksLikeIngredient = (l) => {
      const p = parseLine(l);
      if (isHeading(l)) return false;
      if (/\b(protein|calories|cals?|kcal|macros?|carbs?|fat)\b\s*[:\-]?\s*\d/i.test(l) && !matchFood(p.food)) return false;
      if (/^\s*\d+(?:\.\d+)?\s*(?:g|grams?)?\s*(?:of\s+)?(?:protein|carbs?|fats?|cals?|kcals?|calories)\b/i.test(l)) return false;
      if (/\d+\s*[PCF]\s*\|/.test(l) || /^\s*macros?\b/i.test(l)) return false;
      if (p.qty != null && (p.unit || matchFood(p.food))) return true;
      // Without an amount it's a heading ("Shrimp", "Sauce") or chatter, unless it's a to-taste item.
      return p.toTaste && !!matchFood(l) && l.length <= 40;
    };
    const kept = ex.text.split('\n').filter((l) => l && l !== name && looksLikeIngredient(l));
    let finalName = (ex.name || name)
      .replace(/^(?:let[’']?s\s+make|let\s+us\s+make|here[’']?s|how\s+to\s+make|making|today\s+i[’']?m\s+making|i\s+made|try\s+this|recipe\s+for)\s+(?:an?\s+|my\s+|the\s+|some\s+)?/i, '')
      .replace(/\s+(?:with\s+me|for\s+you|you\s+need\s+to\s+try)\b.*$/i, '')
      .replace(/[!.?:\s]+$/, '');
    finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);
    if (/^(recipe|ingredients?|serves|servings?|macros?)\b/i.test(finalName) || /\b(serves|servings?)\s*\d/i.test(finalName)) finalName = '';
    return { name: finalName, servings: ex.servings, text: kept.join('\n'), stated: stated };
  }

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', frac12: '½', frac14: '¼', frac34: '¾', frac13: '⅓', frac23: '⅔', frac18: '⅛', deg: '°', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', eacute: 'é', ntilde: 'ñ' };
  function decodeEntities(s) {
    return String(s == null ? '' : s)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
      .replace(/&([a-z0-9]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] !== undefined ? ENTITIES[n.toLowerCase()] : m))
      .replace(/\s+/g, ' ')
      .trim();
  }

  function firstNumber(v) {
    const list = Array.isArray(v) ? v : [v];
    for (const x of list) {
      const m = String(x == null ? '' : x).match(/\d+(?:[.,]\d+)?/);
      if (m) return parseFloat(m[0].replace(',', '.'));
    }
    return null;
  }

  /** Finds a schema.org Recipe among parsed JSON-LD blocks (handles @graph and nested arrays). */
  function findRecipeNode(data) {
    const stack = Array.isArray(data) ? data.slice() : [data];
    while (stack.length) {
      const node = stack.shift();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) { stack.push(...node); continue; }
      const type = node['@type'];
      const types = Array.isArray(type) ? type : [type];
      if (types.some((t) => /(^|\/)Recipe$/i.test(String(t || '')))) return node;
      if (node['@graph']) stack.push(node['@graph']);
      if (node.mainEntity) stack.push(node.mainEntity);
      if (node.itemListElement) stack.push(node.itemListElement);
      if (node.item) stack.push(node.item);
    }
    return null;
  }

  /** A schema.org Recipe → { name, servings, text, stated } like the other importers. */
  function recipeFromSchema(node) {
    if (!node) return null;
    let ingredients = node.recipeIngredient || node.ingredients || [];
    if (!Array.isArray(ingredients)) ingredients = [ingredients];
    const lines = ingredients.map(decodeEntities).filter(Boolean);
    if (!lines.length) return null;
    const n = node.nutrition || {};
    const stated = {};
    const protein = firstNumber(n.proteinContent);
    const kcal = firstNumber(n.calories);
    if (protein > 0) stated.protein = protein;
    if (kcal > 0) stated.kcal = kcal;
    const servings = firstNumber(node.recipeYield);
    return {
      name: decodeEntities(node.name || node.headline || '').slice(0, 80),
      servings: servings > 0 && servings <= 100 ? servings : null,
      text: lines.join('\n'),
      stated: stated
    };
  }

  const api = { FOODS, FOOD_BY_ID, parseLine, matchFood, analyzeLine, analyzeRecipe, extractRecipe, extractFromCaption, findRecipeNode, recipeFromSchema, decodeEntities, lineKey, normalize, fromOpenFoodFacts };
  root.PTNutrition = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
