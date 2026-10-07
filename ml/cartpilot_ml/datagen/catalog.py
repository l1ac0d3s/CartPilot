"""Static catalog definition for the synthetic quick-commerce store.

Brands are fictional. Each *product type* expands into SKUs (brand x pack size);
the generator samples exactly the requested number of SKUs from that space.
"""

# slug, display name, icon, GST rate
CATEGORIES = [
    ("dairy", "Dairy", "🥛", 0.05),
    ("bakery", "Bakery & Bread", "🍞", 0.05),
    ("eggs-meat", "Eggs, Meat & Fish", "🥚", 0.00),
    ("fruits", "Fresh Fruits", "🍎", 0.00),
    ("vegetables", "Fresh Vegetables", "🥦", 0.00),
    ("staples", "Atta, Rice & Dal", "🌾", 0.05),
    ("oils-masala", "Oils & Masala", "🫙", 0.05),
    ("breakfast", "Breakfast & Spreads", "🥣", 0.12),
    ("tea-coffee", "Tea & Coffee", "☕", 0.05),
    ("snacks", "Snacks & Biscuits", "🍿", 0.12),
    ("beverages", "Cold Drinks & Juices", "🥤", 0.18),
    ("instant-frozen", "Instant & Frozen Food", "🍜", 0.12),
    ("sweets", "Sweets & Chocolates", "🍫", 0.18),
    ("personal-care", "Personal Care", "🧴", 0.18),
    ("household", "Cleaning & Household", "🧽", 0.18),
    ("baby-care", "Baby Care", "🍼", 0.12),
]

PRODUCE = ["Farm Fresh", "Organic Roots", "Green Basket"]

# type key -> (category slug, product name, brands, [(pack size, base price ₹)], popularity weight)
PRODUCT_TYPES = {
    # Dairy
    "milk": ("dairy", "Toned Milk", ["Amrit Dairy", "Nandan Farms", "Gokul Fresh", "Misty Meadows"], [("500 ml", 28), ("1 L", 56)], 10),
    "full_cream_milk": ("dairy", "Full Cream Milk", ["Amrit Dairy", "Gokul Fresh", "Nandan Farms"], [("500 ml", 34), ("1 L", 68)], 5),
    "curd": ("dairy", "Fresh Curd", ["Amrit Dairy", "Nandan Farms", "Misty Meadows"], [("400 g", 35), ("1 kg", 80)], 7),
    "paneer": ("dairy", "Malai Paneer", ["Amrit Dairy", "Misty Meadows", "Gokul Fresh"], [("200 g", 90), ("500 g", 210)], 5),
    "butter": ("dairy", "Salted Butter", ["Amrit Dairy", "Polar Creamery", "Gokul Fresh"], [("100 g", 58), ("500 g", 275)], 6),
    "cheese": ("dairy", "Cheese Slices", ["Amrit Dairy", "Polar Creamery", "Alpine Gold"], [("10 slices", 145), ("20 slices", 270)], 4),
    "cheese_block": ("dairy", "Mozzarella Cheese", ["Alpine Gold", "Polar Creamery"], [("200 g", 160), ("400 g", 300)], 2),
    "ghee": ("dairy", "Pure Cow Ghee", ["Amrit Dairy", "Gokul Fresh", "Nandan Farms"], [("500 ml", 330), ("1 L", 640)], 3),
    "yogurt": ("dairy", "Greek Yogurt", ["Misty Meadows", "Polar Creamery", "Alpine Gold"], [("90 g", 50), ("400 g", 180)], 3),
    "buttermilk": ("dairy", "Masala Chaas", ["Amrit Dairy", "Nandan Farms", "Gokul Fresh"], [("200 ml", 15), ("1 L", 60)], 3),
    "cream": ("dairy", "Fresh Cream", ["Amrit Dairy", "Polar Creamery"], [("200 ml", 70), ("1 L", 290)], 2),
    "lassi": ("dairy", "Sweet Lassi", ["Amrit Dairy", "Nandan Farms"], [("200 ml", 25)], 2),
    # Bakery
    "bread": ("bakery", "White Bread", ["Bake House", "Daily Loaf", "Golden Crust"], [("400 g", 40), ("700 g", 60)], 8),
    "brown_bread": ("bakery", "Brown Bread", ["Bake House", "Daily Loaf", "Golden Crust"], [("400 g", 50), ("700 g", 75)], 5),
    "multigrain_bread": ("bakery", "Multigrain Bread", ["Bake House", "Golden Crust", "Daily Loaf"], [("400 g", 60)], 3),
    "pav": ("bakery", "Ladi Pav", ["Daily Loaf", "Bake House", "Golden Crust"], [("6 pcs", 35), ("12 pcs", 65)], 4),
    "buns": ("bakery", "Burger Buns", ["Bake House", "Golden Crust"], [("4 pcs", 40)], 2),
    "rusk": ("bakery", "Suji Rusk", ["Daily Loaf", "Golden Crust", "Bake House"], [("200 g", 45), ("400 g", 85)], 3),
    "cake": ("bakery", "Chocolate Truffle Cake", ["Bake House", "Sweet Oven"], [("250 g", 120), ("500 g", 230)], 2),
    "croissant": ("bakery", "Butter Croissant", ["Sweet Oven", "Bake House"], [("2 pcs", 90)], 1),
    # Eggs, meat & fish
    "eggs": ("eggs-meat", "Farm Eggs", ["Eggo Farms", "Happy Hens", "Country Fresh"], [("6 pcs", 54), ("12 pcs", 105), ("30 pcs", 250)], 8),
    "brown_eggs": ("eggs-meat", "Brown Eggs", ["Happy Hens", "Country Fresh"], [("6 pcs", 72), ("12 pcs", 140)], 3),
    "chicken": ("eggs-meat", "Chicken Curry Cut", ["FreshCut", "Meat Mart", "Licious Farms"], [("500 g", 180), ("1 kg", 340)], 5),
    "chicken_breast": ("eggs-meat", "Boneless Chicken Breast", ["FreshCut", "Meat Mart", "Licious Farms"], [("450 g", 260)], 3),
    "mutton": ("eggs-meat", "Mutton Curry Cut", ["FreshCut", "Meat Mart"], [("500 g", 450)], 2),
    "fish": ("eggs-meat", "Rohu Fish Steaks", ["Coastal Catch", "FreshCut"], [("500 g", 220)], 2),
    "prawns": ("eggs-meat", "Medium Prawns", ["Coastal Catch", "FreshCut"], [("250 g", 280)], 1),
    # Fruits
    "banana": ("fruits", "Robusta Banana", PRODUCE, [("6 pcs", 45), ("12 pcs", 85)], 8),
    "apple": ("fruits", "Shimla Apple", PRODUCE, [("4 pcs", 140), ("1 kg", 220)], 6),
    "orange": ("fruits", "Nagpur Orange", PRODUCE, [("1 kg", 120)], 4),
    "pomegranate": ("fruits", "Pomegranate", PRODUCE, [("2 pcs", 130)], 3),
    "grapes": ("fruits", "Green Grapes", PRODUCE[:2], [("500 g", 90)], 3),
    "papaya": ("fruits", "Papaya", PRODUCE[:2], [("1 pc", 60)], 3),
    "watermelon": ("fruits", "Kiran Watermelon", PRODUCE[:2], [("1 pc", 80)], 3),
    "mango": ("fruits", "Alphonso Mango", PRODUCE, [("6 pcs", 450)], 3),
    "guava": ("fruits", "Guava", PRODUCE[:2], [("500 g", 60)], 2),
    "kiwi": ("fruits", "Kiwi", PRODUCE[:2], [("3 pcs", 99)], 2),
    # Vegetables
    "onion": ("vegetables", "Onion", PRODUCE, [("1 kg", 40), ("2 kg", 76)], 10),
    "tomato": ("vegetables", "Tomato", PRODUCE, [("500 g", 25), ("1 kg", 48)], 10),
    "potato": ("vegetables", "Potato", PRODUCE, [("1 kg", 35), ("2 kg", 66)], 9),
    "coriander": ("vegetables", "Coriander Leaves", PRODUCE[:2], [("100 g", 12)], 7),
    "green_chilli": ("vegetables", "Green Chilli", PRODUCE[:2], [("100 g", 10)], 6),
    "ginger": ("vegetables", "Ginger", PRODUCE[:2], [("200 g", 30)], 5),
    "garlic": ("vegetables", "Garlic", PRODUCE[:2], [("200 g", 45)], 5),
    "lemon": ("vegetables", "Lemon", PRODUCE[:2], [("4 pcs", 20)], 5),
    "spinach": ("vegetables", "Spinach (Palak)", PRODUCE, [("250 g", 25)], 4),
    "capsicum": ("vegetables", "Green Capsicum", PRODUCE[:2], [("250 g", 30)], 4),
    "cucumber": ("vegetables", "Cucumber", PRODUCE, [("500 g", 30)], 4),
    "carrot": ("vegetables", "Carrot", PRODUCE, [("500 g", 35)], 4),
    "cauliflower": ("vegetables", "Cauliflower", PRODUCE[:2], [("1 pc", 40)], 3),
    "mushroom": ("vegetables", "Button Mushroom", PRODUCE[:2], [("200 g", 55)], 2),
    # Staples
    "atta": ("staples", "Whole Wheat Atta", ["Golden Harvest", "Annapurna Mills", "Kisan Choice"], [("5 kg", 260), ("10 kg", 500)], 5),
    "rice": ("staples", "Basmati Rice", ["Royal Grain", "Golden Harvest", "Kisan Choice"], [("1 kg", 140), ("5 kg", 650)], 5),
    "sona_masoori": ("staples", "Sona Masoori Rice", ["Royal Grain", "Kisan Choice"], [("5 kg", 380)], 3),
    "toor_dal": ("staples", "Toor Dal", ["Golden Harvest", "Kisan Choice", "Annapurna Mills"], [("1 kg", 160)], 5),
    "moong_dal": ("staples", "Moong Dal", ["Golden Harvest", "Kisan Choice"], [("500 g", 75), ("1 kg", 145)], 3),
    "chana_dal": ("staples", "Chana Dal", ["Golden Harvest", "Annapurna Mills"], [("1 kg", 110)], 2),
    "rajma": ("staples", "Rajma", ["Golden Harvest", "Kisan Choice"], [("500 g", 95)], 2),
    "sugar": ("staples", "Sugar", ["Kisan Choice", "Sweet Crystal"], [("1 kg", 48), ("5 kg", 230)], 5),
    "salt": ("staples", "Iodised Salt", ["Pure Sea", "Kisan Choice"], [("1 kg", 25)], 4),
    "poha": ("staples", "Thick Poha", ["Golden Harvest", "Annapurna Mills"], [("500 g", 40), ("1 kg", 75)], 3),
    "besan": ("staples", "Besan", ["Golden Harvest", "Annapurna Mills"], [("500 g", 60)], 2),
    "sooji": ("staples", "Sooji Rava", ["Annapurna Mills", "Golden Harvest"], [("500 g", 38)], 2),
    # Oils & masala
    "sunflower_oil": ("oils-masala", "Refined Sunflower Oil", ["Sunlite", "Golden Drop", "Kisan Choice"], [("1 L", 155), ("5 L", 720)], 5),
    "mustard_oil": ("oils-masala", "Kachi Ghani Mustard Oil", ["Golden Drop", "Kisan Choice"], [("1 L", 175)], 3),
    "olive_oil": ("oils-masala", "Extra Virgin Olive Oil", ["Mediterra", "Golden Drop"], [("500 ml", 520)], 1),
    "turmeric": ("oils-masala", "Turmeric Powder", ["Spice Route", "Masala King"], [("100 g", 35), ("200 g", 65)], 3),
    "chilli_powder": ("oils-masala", "Red Chilli Powder", ["Spice Route", "Masala King"], [("100 g", 45), ("200 g", 85)], 3),
    "garam_masala": ("oils-masala", "Garam Masala", ["Spice Route", "Masala King"], [("100 g", 75)], 2),
    "cumin": ("oils-masala", "Cumin Seeds", ["Spice Route", "Masala King"], [("100 g", 60)], 2),
    "ginger_garlic_paste": ("oils-masala", "Ginger Garlic Paste", ["Masala King", "Spice Route"], [("200 g", 55)], 3),
    "chicken_masala": ("oils-masala", "Chicken Masala", ["Masala King", "Spice Route"], [("100 g", 80)], 2),
    # Breakfast
    "cornflakes": ("breakfast", "Corn Flakes", ["Morning Crunch", "Nutri Start"], [("250 g", 110), ("475 g", 190)], 4),
    "oats": ("breakfast", "Rolled Oats", ["Nutri Start", "Morning Crunch", "Oat Valley"], [("500 g", 120), ("1 kg", 210)], 4),
    "muesli": ("breakfast", "Fruit & Nut Muesli", ["Nutri Start", "Morning Crunch", "Oat Valley"], [("500 g", 320)], 2),
    "jam": ("breakfast", "Mixed Fruit Jam", ["Fruit Valley", "Orchard Gold"], [("200 g", 75), ("500 g", 160)], 3),
    "peanut_butter": ("breakfast", "Crunchy Peanut Butter", ["Nutty Spread", "Orchard Gold", "Oat Valley"], [("340 g", 180), ("1 kg", 450)], 3),
    "honey": ("breakfast", "Pure Honey", ["Bee Natural", "Orchard Gold"], [("250 g", 130), ("500 g", 240)], 3),
    "choco_spread": ("breakfast", "Hazelnut Cocoa Spread", ["Nutty Spread", "Cocoa Bliss"], [("350 g", 350)], 1),
    # Tea & coffee
    "tea": ("tea-coffee", "Premium Assam Tea", ["Assam Leaf", "Chai Bagh", "Tea Garden"], [("250 g", 140), ("500 g", 270), ("1 kg", 520)], 6),
    "green_tea": ("tea-coffee", "Green Tea Bags", ["Tea Garden", "Chai Bagh"], [("25 bags", 160), ("100 bags", 520)], 2),
    "coffee": ("tea-coffee", "Instant Coffee", ["Brew Bean", "Coffee House"], [("50 g", 160), ("100 g", 300)], 4),
    "filter_coffee": ("tea-coffee", "Filter Coffee Powder", ["Coffee House", "Brew Bean"], [("200 g", 180)], 2),
    # Snacks & biscuits
    "chips": ("snacks", "Classic Salted Chips", ["Crunchy Bites", "Snack Shack", "Potato Gold"], [("52 g", 20), ("90 g", 40)], 8),
    "masala_chips": ("snacks", "Masala Potato Chips", ["Crunchy Bites", "Snack Shack", "Potato Gold"], [("52 g", 20), ("90 g", 40)], 6),
    "namkeen": ("snacks", "Aloo Bhujia", ["Desi Crunch", "Snack Shack"], [("200 g", 55), ("400 g", 105)], 5),
    "nachos": ("snacks", "Cheese Nachos", ["Snack Shack", "Crunchy Bites"], [("150 g", 60)], 3),
    "salsa": ("snacks", "Salsa Dip", ["Snack Shack", "Italiano"], [("250 g", 140)], 1),
    "popcorn": ("snacks", "Butter Popcorn", ["Pop Time", "Snack Shack"], [("3 packs", 99)], 2),
    "peanuts": ("snacks", "Salted Peanuts", ["Desi Crunch", "Snack Shack"], [("200 g", 50)], 2),
    "biscuits": ("snacks", "Cream Biscuits", ["Biscuit Co", "Tea Time", "Crunchy Bites"], [("120 g", 30), ("300 g", 70)], 7),
    "marie_biscuits": ("snacks", "Marie Biscuits", ["Tea Time", "Biscuit Co"], [("250 g", 35), ("600 g", 80)], 4),
    "cookies": ("snacks", "Choco Chip Cookies", ["Biscuit Co", "Sweet Oven"], [("150 g", 60), ("300 g", 110)], 3),
    "khakhra": ("snacks", "Methi Khakhra", ["Desi Crunch"], [("200 g", 70)], 1),
    # Beverages
    "cola": ("beverages", "Cola", ["Fizz Up", "Cool Cola"], [("750 ml", 40), ("2 L", 95)], 6),
    "lemon_soda": ("beverages", "Lemon Soda", ["Fizz Up", "Cool Cola"], [("750 ml", 40)], 3),
    "orange_juice": ("beverages", "Orange Juice", ["Fruit Valley", "Juicy Day"], [("1 L", 120)], 3),
    "mixed_juice": ("beverages", "Mixed Fruit Juice", ["Juicy Day", "Fruit Valley"], [("1 L", 110), ("200 ml", 25)], 3),
    "water": ("beverages", "Packaged Drinking Water", ["Aqua Pure", "Himalayan Spring"], [("1 L", 20), ("5 L", 80)], 5),
    "energy_drink": ("beverages", "Energy Drink", ["Volt", "Power Up"], [("250 ml", 110)], 2),
    "coconut_water": ("beverages", "Tender Coconut Water", ["Coco Fresh", "Juicy Day"], [("200 ml", 45), ("1 L", 160)], 3),
    "cold_coffee": ("beverages", "Cold Coffee", ["Brew Bean", "Coffee House"], [("180 ml", 60)], 2),
    "tonic_water": ("beverages", "Tonic Water", ["Fizz Up"], [("300 ml", 60)], 1),
    # Instant & frozen
    "noodles": ("instant-frozen", "Masala Instant Noodles", ["Quick Bowl", "Noodle Hut"], [("4 pack", 56), ("8 pack", 108)], 7),
    "pasta": ("instant-frozen", "Penne Pasta", ["Italiano", "Quick Bowl"], [("500 g", 95), ("1 kg", 180)], 3),
    "pasta_sauce": ("instant-frozen", "Arrabbiata Pasta Sauce", ["Italiano", "Red Valley"], [("400 g", 150)], 2),
    "ketchup": ("instant-frozen", "Tomato Ketchup", ["Red Valley", "Italiano"], [("500 g", 110), ("1 kg", 190)], 5),
    "frozen_peas": ("instant-frozen", "Frozen Green Peas", ["Frost Fresh", "Crispy Kitchen"], [("500 g", 90), ("1 kg", 170)], 3),
    "fries": ("instant-frozen", "Frozen French Fries", ["Frost Fresh", "Crispy Kitchen"], [("420 g", 120), ("1 kg", 260)], 3),
    "nuggets": ("instant-frozen", "Chicken Nuggets", ["Crispy Kitchen", "Frost Fresh"], [("400 g", 220)], 2),
    "ice_cream": ("instant-frozen", "Vanilla Ice Cream", ["Polar Creamery", "Frosty"], [("500 ml", 150), ("1 L", 260)], 4),
    "kulfi": ("instant-frozen", "Malai Kulfi", ["Frosty", "Polar Creamery"], [("4 pcs", 120)], 2),
    "soup": ("instant-frozen", "Tomato Soup Mix", ["Quick Bowl", "Italiano"], [("4 pack", 80)], 2),
    "ready_meal": ("instant-frozen", "Ready-to-eat Dal Makhani", ["Home Chef", "Quick Bowl"], [("300 g", 120)], 2),
    # Sweets & chocolates
    "chocolate": ("sweets", "Milk Chocolate Bar", ["Choco Joy", "Cocoa Bliss"], [("50 g", 50), ("120 g", 120)], 6),
    "dark_chocolate": ("sweets", "Dark Chocolate 70%", ["Cocoa Bliss", "Choco Joy"], [("100 g", 180)], 2),
    "gulab_jamun": ("sweets", "Gulab Jamun Tin", ["Mithai Ghar", "Sweet Bengal"], [("1 kg", 220)], 2),
    "rasgulla": ("sweets", "Rasgulla Tin", ["Sweet Bengal", "Mithai Ghar"], [("1 kg", 210)], 2),
    "kaju_katli": ("sweets", "Kaju Katli", ["Mithai Ghar", "Sweet Bengal"], [("250 g", 300)], 2),
    "choco_wafer": ("sweets", "Chocolate Wafer", ["Choco Joy", "Cocoa Bliss"], [("4 pack", 80)], 3),
    "gift_box": ("sweets", "Assorted Chocolate Gift Box", ["Cocoa Bliss", "Choco Joy"], [("250 g", 450)], 1),
    # Personal care
    "shampoo": ("personal-care", "Anti-Dandruff Shampoo", ["Silk & Shine", "Herbal Roots"], [("180 ml", 180), ("340 ml", 320)], 3),
    "conditioner": ("personal-care", "Smooth Conditioner", ["Silk & Shine", "Herbal Roots"], [("180 ml", 190)], 2),
    "soap": ("personal-care", "Bathing Soap", ["Pure Glow", "Herbal Roots", "Neem Fresh"], [("4 x 100 g", 160)], 4),
    "toothpaste": ("personal-care", "Toothpaste", ["Smile Bright", "Neem Fresh"], [("150 g", 95), ("300 g", 180)], 4),
    "toothbrush": ("personal-care", "Soft Toothbrush", ["Smile Bright", "Neem Fresh"], [("2 pcs", 80)], 2),
    "face_wash": ("personal-care", "Face Wash", ["Pure Glow", "Neem Fresh"], [("100 ml", 160)], 2),
    "deodorant": ("personal-care", "Deodorant Spray", ["Urban Musk", "Pure Glow"], [("150 ml", 220)], 2),
    "sanitizer": ("personal-care", "Hand Sanitizer", ["Germ Shield", "Neem Fresh"], [("200 ml", 100)], 2),
    "handwash": ("personal-care", "Liquid Handwash", ["Germ Shield", "Pure Glow"], [("200 ml", 99), ("750 ml", 199)], 3),
    "sanitary_pads": ("personal-care", "Sanitary Pads", ["Comfort Care", "Pure Glow"], [("15 pads", 190), ("30 pads", 360)], 2),
    "shaving_foam": ("personal-care", "Shaving Foam", ["Urban Musk"], [("200 g", 210)], 1),
    # Household
    "detergent": ("household", "Detergent Powder", ["Wash Pro", "Bright Clean"], [("1 kg", 130), ("4 kg", 480)], 4),
    "liquid_detergent": ("household", "Liquid Detergent", ["Wash Pro", "Bright Clean"], [("1 L", 220), ("2 L", 420)], 3),
    "dishwash": ("household", "Dishwash Gel", ["Shine Bright", "Bright Clean"], [("500 ml", 115), ("1 L", 210)], 4),
    "dishwash_bar": ("household", "Dishwash Bar", ["Shine Bright", "Bright Clean"], [("3 x 200 g", 60)], 3),
    "floor_cleaner": ("household", "Floor Cleaner", ["Clean Home", "Germ Shield"], [("1 L", 190), ("2 L", 360)], 3),
    "toilet_cleaner": ("household", "Toilet Cleaner", ["Clean Home", "Germ Shield"], [("500 ml", 99), ("1 L", 185)], 2),
    "garbage_bags": ("household", "Garbage Bags (Medium)", ["Eco Bag", "Clean Home"], [("30 pcs", 99), ("90 pcs", 270)], 3),
    "tissues": ("household", "Facial Tissues", ["Soft Touch", "Eco Bag"], [("100 pulls", 90)], 2),
    "kitchen_towel": ("household", "Kitchen Towel Roll", ["Soft Touch"], [("2 rolls", 120), ("4 rolls", 230)], 2),
    "aluminium_foil": ("household", "Aluminium Foil", ["Kitchen Pro"], [("9 m", 99), ("25 m", 250)], 1),
    "mosquito_repellent": ("household", "Mosquito Repellent Refill", ["Guard Night", "Clean Home"], [("45 ml", 85)], 2),
    # Baby care
    "diapers": ("baby-care", "Baby Diapers (M)", ["Little Joy", "Baby Soft"], [("32 pcs", 599), ("64 pcs", 1099)], 3),
    "baby_wipes": ("baby-care", "Baby Wipes", ["Little Joy", "Baby Soft"], [("72 pcs", 199), ("3 x 72 pcs", 549)], 3),
    "baby_food": ("baby-care", "Baby Cereal (Rice)", ["Tiny Tummy", "Little Joy"], [("300 g", 280)], 2),
    "baby_lotion": ("baby-care", "Baby Lotion", ["Baby Soft", "Little Joy"], [("200 ml", 230)], 1),
    "baby_shampoo": ("baby-care", "Tear-free Baby Shampoo", ["Baby Soft", "Little Joy"], [("200 ml", 210)], 1),
}

# Directed "people who buy A also buy B" rules (type level) that shape co-purchase patterns.
COMPLEMENTS = {
    "milk": [("bread", 0.30), ("eggs", 0.22), ("tea", 0.08), ("cornflakes", 0.08), ("banana", 0.10)],
    "full_cream_milk": [("bread", 0.25), ("coffee", 0.10)],
    "bread": [("butter", 0.30), ("eggs", 0.25), ("jam", 0.15), ("cheese", 0.10), ("peanut_butter", 0.06)],
    "brown_bread": [("peanut_butter", 0.25), ("eggs", 0.20), ("butter", 0.12)],
    "multigrain_bread": [("peanut_butter", 0.25), ("brown_eggs", 0.20)],
    "eggs": [("bread", 0.30), ("butter", 0.10)],
    "pav": [("butter", 0.40), ("potato", 0.25), ("onion", 0.15)],
    "buns": [("cheese", 0.35), ("ketchup", 0.30), ("nuggets", 0.15)],
    "chips": [("cola", 0.30), ("namkeen", 0.15), ("chocolate", 0.10)],
    "masala_chips": [("cola", 0.28), ("lemon_soda", 0.12)],
    "nachos": [("salsa", 0.45), ("cola", 0.25), ("cheese_block", 0.10)],
    "namkeen": [("tea", 0.10), ("cola", 0.10)],
    "noodles": [("ketchup", 0.15), ("eggs", 0.12), ("cola", 0.08)],
    "pasta": [("pasta_sauce", 0.50), ("cheese_block", 0.30), ("olive_oil", 0.08)],
    "fries": [("ketchup", 0.40), ("nuggets", 0.20)],
    "nuggets": [("ketchup", 0.35), ("fries", 0.25)],
    "tea": [("biscuits", 0.30), ("milk", 0.30), ("sugar", 0.15), ("marie_biscuits", 0.15), ("rusk", 0.12)],
    "coffee": [("milk", 0.30), ("sugar", 0.12), ("cookies", 0.10)],
    "filter_coffee": [("milk", 0.35)],
    "cornflakes": [("milk", 0.50), ("banana", 0.15), ("honey", 0.08)],
    "oats": [("milk", 0.30), ("honey", 0.20), ("banana", 0.20)],
    "muesli": [("yogurt", 0.30), ("milk", 0.25)],
    "diapers": [("baby_wipes", 0.60), ("baby_lotion", 0.08)],
    "baby_food": [("banana", 0.25), ("baby_wipes", 0.15)],
    "rice": [("toor_dal", 0.35), ("sunflower_oil", 0.15), ("moong_dal", 0.10)],
    "sona_masoori": [("toor_dal", 0.30), ("rajma", 0.10)],
    "atta": [("sunflower_oil", 0.20), ("ghee", 0.15), ("salt", 0.10)],
    "toor_dal": [("rice", 0.25), ("turmeric", 0.12)],
    "onion": [("tomato", 0.60), ("potato", 0.35), ("coriander", 0.30), ("green_chilli", 0.25), ("ginger", 0.15)],
    "tomato": [("onion", 0.45), ("coriander", 0.20), ("green_chilli", 0.15)],
    "potato": [("onion", 0.40), ("tomato", 0.20)],
    "chicken": [("onion", 0.45), ("ginger_garlic_paste", 0.35), ("chicken_masala", 0.30), ("curd", 0.25), ("lemon", 0.20), ("tomato", 0.30)],
    "chicken_breast": [("lemon", 0.25), ("olive_oil", 0.10), ("capsicum", 0.15)],
    "mutton": [("onion", 0.50), ("ginger_garlic_paste", 0.35), ("garam_masala", 0.30), ("curd", 0.25)],
    "fish": [("lemon", 0.35), ("turmeric", 0.20), ("mustard_oil", 0.15)],
    "paneer": [("capsicum", 0.30), ("onion", 0.25), ("tomato", 0.25), ("cream", 0.10)],
    "shampoo": [("conditioner", 0.30), ("soap", 0.15)],
    "detergent": [("dishwash", 0.25), ("floor_cleaner", 0.10)],
    "liquid_detergent": [("dishwash", 0.25)],
    "dishwash": [("dishwash_bar", 0.10), ("garbage_bags", 0.10)],
    "ice_cream": [("chocolate", 0.15), ("choco_wafer", 0.10)],
    "cola": [("chips", 0.30), ("masala_chips", 0.15), ("namkeen", 0.10)],
    "cake": [("ice_cream", 0.20), ("cola", 0.15)],
    "toothpaste": [("toothbrush", 0.25)],
    "curd": [("cucumber", 0.10), ("rice", 0.08)],
    "apple": [("banana", 0.20)],
    "kulfi": [("gulab_jamun", 0.10)],
}

# Customer archetypes. `staples` are the types a customer of this persona buys repeatedly.
PERSONAS = {
    "daily_essentials": dict(
        share=0.24,
        staples=["milk", "bread", "eggs", "curd", "banana", "tomato", "onion", "butter", "biscuits", "coriander", "potato", "tea"],
        n_staples=(5, 9), basket=(3, 5), gap_days=(2.5, 5), hours=(7, 10), preferred_days=None,
        explore=["dairy", "bakery", "fruits", "vegetables", "breakfast"],
    ),
    "family_stocker": dict(
        share=0.18,
        staples=["atta", "rice", "toor_dal", "sunflower_oil", "sugar", "onion", "potato", "tomato", "full_cream_milk",
                 "detergent", "dishwash", "salt", "ghee", "tea", "biscuits", "turmeric"],
        n_staples=(7, 11), basket=(6, 10), gap_days=(7, 12), hours=(9, 12), preferred_days=[5, 6],
        explore=["staples", "oils-masala", "household", "vegetables", "snacks"],
    ),
    "bachelor_snacker": dict(
        share=0.18,
        staples=["chips", "masala_chips", "cola", "noodles", "namkeen", "ice_cream", "chocolate", "energy_drink",
                 "bread", "eggs", "nachos", "cold_coffee"],
        n_staples=(5, 8), basket=(3, 5), gap_days=(4, 8), hours=(21, 25), preferred_days=[4, 5],
        explore=["snacks", "beverages", "instant-frozen", "sweets"],
    ),
    "health_conscious": dict(
        share=0.14,
        staples=["oats", "yogurt", "banana", "apple", "spinach", "brown_bread", "green_tea", "muesli", "honey",
                 "coconut_water", "brown_eggs", "cucumber", "peanut_butter", "kiwi"],
        n_staples=(6, 9), basket=(4, 6), gap_days=(4, 8), hours=(6, 9), preferred_days=None,
        explore=["fruits", "vegetables", "breakfast", "dairy"],
    ),
    "new_parent": dict(
        share=0.10,
        staples=["diapers", "baby_wipes", "milk", "banana", "baby_food", "curd", "apple", "handwash", "detergent",
                 "bread", "eggs"],
        n_staples=(5, 8), basket=(4, 7), gap_days=(4, 8), hours=(10, 22), preferred_days=None,
        explore=["baby-care", "dairy", "fruits", "household", "personal-care"],
    ),
    "home_cook": dict(
        share=0.10,
        staples=["chicken", "onion", "tomato", "ginger_garlic_paste", "coriander", "green_chilli", "rice", "curd",
                 "lemon", "garam_masala", "fish", "mutton", "turmeric", "chilli_powder"],
        n_staples=(6, 10), basket=(5, 8), gap_days=(6, 10), hours=(9, 12), preferred_days=[6],
        explore=["eggs-meat", "vegetables", "oils-masala", "staples"],
    ),
    "party_host": dict(
        share=0.06,
        staples=["cola", "chips", "namkeen", "ice_cream", "nachos", "fries", "nuggets", "lemon_soda", "chocolate",
                 "gulab_jamun", "water", "popcorn", "cake", "tonic_water"],
        n_staples=(6, 10), basket=(6, 10), gap_days=(12, 25), hours=(18, 22), preferred_days=[4, 5],
        explore=["snacks", "beverages", "sweets", "instant-frozen"],
    ),
}

# Seasonal boosts by month (1-12): type -> multiplier on inclusion probability.
SUMMER = {"cola": 1.6, "lemon_soda": 1.8, "ice_cream": 2.0, "kulfi": 2.0, "watermelon": 3.0, "mango": 4.0,
          "coconut_water": 1.8, "water": 1.5, "buttermilk": 1.8, "lassi": 1.8, "energy_drink": 1.3}
WINTER = {"tea": 1.4, "coffee": 1.4, "soup": 2.5, "honey": 1.3, "orange": 1.8, "carrot": 1.6, "spinach": 1.4}
FESTIVE = {"kaju_katli": 4.0, "gulab_jamun": 3.0, "rasgulla": 3.0, "gift_box": 5.0, "namkeen": 1.5, "ghee": 1.5}
OFF_SEASON = {"mango": 0.05, "watermelon": 0.3}


def seasonal_multiplier(type_key: str, month: int, day: int) -> float:
    mult = 1.0
    if month in (4, 5, 6):
        mult *= SUMMER.get(type_key, 1.0)
    else:
        mult *= OFF_SEASON.get(type_key, 1.0)
    if month in (12, 1):
        mult *= WINTER.get(type_key, 1.0)
    if (month == 10 and day >= 15) or (month == 11 and day <= 15):
        mult *= FESTIVE.get(type_key, 1.0)
    return mult


FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Shaurya",
    "Atharv", "Kabir", "Rohan", "Rahul", "Karan", "Nikhil", "Siddharth", "Varun", "Aman", "Yash", "Dev", "Harsh",
    "Ananya", "Diya", "Aadhya", "Saanvi", "Pari", "Anika", "Navya", "Myra", "Sara", "Ira", "Kiara", "Riya",
    "Priya", "Sneha", "Pooja", "Neha", "Kavya", "Meera", "Tanvi", "Ishita", "Nisha", "Aisha", "Zoya", "Fatima",
    "Arnav", "Pranav", "Tanmay", "Gaurav", "Manish", "Deepak", "Lakshmi", "Divya", "Shreya", "Aditi", "Bhavna",
]
LAST_NAMES = [
    "Sharma", "Verma", "Gupta", "Patel", "Reddy", "Iyer", "Nair", "Menon", "Rao", "Khan", "Singh", "Das",
    "Bose", "Chatterjee", "Mukherjee", "Joshi", "Kulkarni", "Deshpande", "Pillai", "Agarwal", "Mehta", "Shah",
    "Kapoor", "Malhotra", "Bhat", "Hegde", "Shetty", "Naidu", "Chopra", "Banerjee", "Mishra", "Pandey", "Yadav",
]
LOCALITIES = [
    "Koramangala", "Indiranagar", "HSR Layout", "Whitefield", "Jayanagar", "BTM Layout", "Marathahalli",
    "Electronic City", "Bellandur", "JP Nagar", "Malleshwaram", "Hebbal", "Banashankari", "Sarjapur Road",
]
