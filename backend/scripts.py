import pandas as pd

def clean_database_headers():
    print("Loading original CSV...")
    df = pd.read_csv('./data/cost_living.csv')
    
    column_mapping = {
        "city": "city",
        "country": "country",
        "Meal, Inexpensive Restaurant (USD)": "meal_inexpensive",
        "Meal for 2 People, Mid-range Restaurant, Three-course (USD)": "meal_mid_range",
        "McMeal at McDonalds (or Equivalent Combo Meal) (USD)": "mcmeal",
        "Domestic Beer (0.5 liter draught, in restaurants) (USD)": "beer_domestic_restaurant",
        "Imported Beer (0.33 liter bottle, in restaurants) (USD)": "beer_imported_restaurant",
        "Cappuccino (regular, in restaurants) (USD)": "cappuccino",
        "Coke/Pepsi (0.33 liter bottle, in restaurants) (USD)": "coke_pepsi",
        "Water (0.33 liter bottle, in restaurants) (USD)": "water_0_33l_restaurant",
        "Milk (regular), (1 liter) (USD)": "milk_1l",
        "Loaf of Fresh White Bread (500g) (USD)": "bread_500g",
        "Rice (white), (1kg) (USD)": "rice_1kg",
        "Eggs (regular) (12) (USD)": "eggs_12",
        "Local Cheese (1kg) (USD)": "cheese_1kg",
        "Chicken Fillets (1kg) (USD)": "chicken_1kg",
        "Beef Round (1kg) (or Equivalent Back Leg Red Meat) (USD)": "beef_1kg",
        "Apples (1kg) (USD)": "apples_1kg",
        "Banana (1kg) (USD)": "banana_1kg",
        "Oranges (1kg) (USD)": "oranges_1kg",
        "Tomato (1kg) (USD)": "tomato_1kg",
        "Potato (1kg) (USD)": "potato_1kg",
        "Onion (1kg) (USD)": "onion_1kg",
        "Lettuce (1 head) (USD)": "lettuce_1_head",
        "Water (1.5 liter bottle, at the market) (USD)": "water_1_5l_market",
        "Bottle of Wine (Mid-Range, at the market) (USD)": "wine_mid_range",
        "Domestic Beer (0.5 liter bottle, at the market) (USD)": "beer_domestic_market",
        "Imported Beer (0.33 liter bottle, at the market) (USD)": "beer_imported_market",
        "Cigarettes 20 Pack (Marlboro) (USD)": "cigarettes_marlboro",
        "One-way Ticket (Local Transport) (USD)": "transit_one_way",
        "Monthly Pass (Regular Price) (USD)": "transit_monthly_pass",
        "Taxi Start (Normal Tariff) (USD)": "taxi_start",
        "Taxi 1km (Normal Tariff) (USD)": "taxi_1km",
        "Taxi 1hour Waiting (Normal Tariff) (USD)": "taxi_1hr_wait",
        "Gasoline (1 liter) (USD)": "gasoline_1l",
        "Volkswagen Golf 1.4 90 KW Trendline (Or Equivalent New Car) (USD)": "car_vw_golf",
        "Toyota Corolla Sedan 1.6l 97kW Comfort (Or Equivalent New Car) (USD)": "car_toyota_corolla",
        "Basic (Electricity, Heating, Cooling, Water, Garbage) for 85m2 Apartment (USD)": "utilities_85m2",
        "1 min. of Prepaid Mobile Tariff Local (No Discounts or Plans) (USD)": "mobile_tariff_1min",
        "Internet (60 Mbps or More, Unlimited Data, Cable/ADSL) (USD)": "internet_60mbps",
        "Fitness Club, Monthly Fee for 1 Adult (USD)": "fitness_club_monthly",
        "Tennis Court Rent (1 Hour on Weekend) (USD)": "tennis_court_1hr",
        "Cinema, International Release, 1 Seat (USD)": "cinema_1_seat",
        "Preschool (or Kindergarten), Full Day, Private, Monthly for 1 Child (USD)": "preschool_monthly",
        "International Primary School, Yearly for 1 Child (USD)": "primary_school_yearly",
        "1 Pair of Jeans (Levis 501 Or Similar) (USD)": "jeans_levis",
        "1 Summer Dress in a Chain Store (Zara, H&M, …) (USD)": "summer_dress",
        "1 Pair of Nike Running Shoes (Mid-Range) (USD)": "running_shoes_nike",
        "1 Pair of Men Leather Business Shoes (USD)": "business_shoes_leather",
        "Apartment (1 bedroom) in City Centre (USD)": "rent_1br_city_center",
        "Apartment (1 bedroom) Outside of Centre (USD)": "rent_1br_outside_center",
        "Apartment (3 bedrooms) in City Centre (USD)": "rent_3br_city_center",
        "Apartment (3 bedrooms) Outside of Centre (USD)": "rent_3br_outside_center",
        "Price per Square Meter to Buy Apartment in City Centre (USD)": "buy_sqm_city_center",
        "Price per Square Meter to Buy Apartment Outside of Centre (USD)": "buy_sqm_outside_center",
        "Average Monthly Net Salary (After Tax) (USD)": "net_salary_monthly",
        "Mortgage Interest Rate in Percentages (%), Yearly, for 20 Years Fixed-Rate": "mortgage_interest_rate",
        "data_quality": "data_quality"
    }
    
    # Rename columns using the dictionary
    df.rename(columns=column_mapping, inplace=True)
    
    # Export to a new CSV
    output_filename = 'cost_living_clean.csv'
    df.to_csv(output_filename, index=False)
    print(f"✅ Success! New database-ready CSV saved as: {output_filename}")

if __name__ == "__main__":
    clean_database_headers()