"""
Generate 300 synthetic farmer profiles for testing.
Each profile has expected eligible schemes for validation.
"""
import random
import json
from typing import List, Dict, Any

STATES = ["maharashtra", "uttar_pradesh", "madhya_pradesh", "rajasthan", "karnataka", 
          "gujarat", "punjab", "haryana", "bihar", "west_bengal", "andhra_pradesh",
          "tamil_nadu", "telangana", "odisha", "kerala"]

DISTRICTS = {
    "maharashtra": ["pune", "nashik", "nagpur", "aurangabad", "kolhapur"],
    "uttar_pradesh": ["lucknow", "varanasi", "agra", "kanpur", "meerut"],
    "madhya_pradesh": ["bhopal", "indore", "jabalpur", "gwalior", "ujjain"],
    "rajasthan": ["jaipur", "jodhpur", "udaipur", "kota", "ajmer"],
    "karnataka": ["bangalore", "mysore", "hubli", "mangalore", "belgaum"],
    "gujarat": ["ahmedabad", "surat", "vadodara", "rajkot", "bhavnagar"],
    "punjab": ["ludhiana", "amritsar", "jalandhar", "patiala", "bathinda"],
    "haryana": ["gurugram", "faridabad", "panipat", "ambala", "rohtak"],
    "bihar": ["patna", "gaya", "muzaffarpur", "bhagalpur", "darbhanga"],
    "west_bengal": ["kolkata", "howrah", "durgapur", "siliguri", "asansol"],
    "andhra_pradesh": ["visakhapatnam", "vijayawada", "guntur", "nellore", "kurnool"],
    "tamil_nadu": ["chennai", "coimbatore", "madurai", "salem", "trichy"],
    "telangana": ["hyderabad", "warangal", "nizamabad", "karimnagar", "khammam"],
    "odisha": ["bhubaneswar", "cuttack", "rourkela", "berhampur", "sambalpur"],
    "kerala": ["thiruvananthapuram", "kochi", "kozhikode", "thrissur", "kollam"]
}

CROPS = ["rice", "wheat", "cotton", "sugarcane", "pulses", "oilseeds", "vegetables", 
         "fruits", "spices", "maize", "millets", "groundnut", "soybean", "mustard"]

LAND_TYPES = ["irrigated", "rainfed", "dryland"]
FARMER_TYPES = ["owner", "tenant", "sharecropper"]
GENDERS = ["male", "female"]
CATEGORIES = ["general", "obc", "sc", "st"]

FIRST_NAMES_MALE = ["Ramesh", "Suresh", "Mahesh", "Rajesh", "Ganesh", "Anil", "Sunil", 
                    "Vijay", "Sanjay", "Ravi", "Prakash", "Dinesh", "Mukesh", "Rakesh"]
FIRST_NAMES_FEMALE = ["Sita", "Gita", "Radha", "Lakshmi", "Parvati", "Saraswati", 
                      "Kamala", "Sunita", "Anita", "Meera", "Kavita", "Savita"]
LAST_NAMES = ["Kumar", "Singh", "Sharma", "Verma", "Gupta", "Patel", "Yadav", "Reddy",
              "Naidu", "Rao", "Das", "Mishra", "Pandey", "Joshi", "Thakur"]


def generate_profile(profile_id: int) -> Dict[str, Any]:
    """Generate a single synthetic farmer profile."""
    gender = random.choice(GENDERS)
    first_names = FIRST_NAMES_MALE if gender == "male" else FIRST_NAMES_FEMALE
    
    state = random.choice(STATES)
    district = random.choice(DISTRICTS[state])
    
    # Generate realistic distributions
    acreage = round(random.triangular(0.5, 10, 2), 1)  # Most farmers have small holdings
    income = random.choice([50000, 80000, 100000, 120000, 150000, 200000, 250000, 300000])
    age = random.randint(22, 70)
    family_count = random.randint(2, 8)
    
    # Crop selection based on acreage
    num_crops = min(random.randint(1, 3), int(acreage) + 1)
    main_crops = random.sample(CROPS, num_crops)
    
    profile = {
        "profile_id": f"FARMER_{profile_id:04d}",
        "name": f"{random.choice(first_names)} {random.choice(LAST_NAMES)}",
        "mobile": f"9{random.randint(100000000, 999999999)}",
        "gender": gender,
        "age": age,
        "category": random.choice(CATEGORIES),
        "state": state,
        "district": district,
        "land_type": random.choice(LAND_TYPES),
        "acreage": acreage,
        "main_crops": main_crops,
        "farmer_type": random.choice(FARMER_TYPES),
        "family_count": family_count,
        "annual_income": income,
        "has_bank_account": random.random() > 0.1,  # 90% have bank accounts
        "has_kcc": random.random() > 0.6,  # 40% have KCC
        "has_soil_health_card": random.random() > 0.7,  # 30% have SHC
        "is_drought_affected": random.random() > 0.8,  # 20% drought affected
        "is_flood_affected": random.random() > 0.9,  # 10% flood affected
    }
    
    # Add expected eligible schemes based on profile
    profile["expected_schemes"] = determine_expected_schemes(profile)
    
    return profile


def determine_expected_schemes(profile: Dict[str, Any]) -> List[str]:
    """Determine which schemes a profile should be eligible for."""
    eligible = []
    
    # PM-KISAN: All farmers with land <=2 hectares
    if profile["acreage"] <= 2 and profile["farmer_type"] == "owner":
        eligible.append("pm_kisan")
    
    # PMFBY: All farmers with crops
    if profile["main_crops"]:
        eligible.append("pmfby")
    
    # KCC: Land owning farmers
    if profile["farmer_type"] in ["owner", "tenant"]:
        eligible.append("kcc")
    
    # Soil Health Card: All farmers
    eligible.append("soil_health_card")
    
    # PMKSY: Irrigated land farmers
    if profile["land_type"] == "irrigated":
        eligible.append("pmksy")
    
    # eNAM: Farmers with >1 hectare
    if profile["acreage"] >= 1:
        eligible.append("enam")
    
    # PKVY: Organic potential (small farmers)
    if profile["acreage"] <= 2:
        eligible.append("pkvy")
    
    # RKVY: State schemes - all farmers
    eligible.append("rkvy")
    
    # NFSM: Specific crops
    if any(crop in ["rice", "wheat", "pulses", "oilseeds"] for crop in profile["main_crops"]):
        eligible.append("nfsm")
    
    # NMOOP: Oilseed farmers
    if any(crop in ["groundnut", "mustard", "soybean", "oilseeds"] for crop in profile["main_crops"]):
        eligible.append("nmoop")
    
    # MIDH: Horticulture crops
    if any(crop in ["fruits", "vegetables", "spices"] for crop in profile["main_crops"]):
        eligible.append("midh")
    
    # Drought Relief: Drought affected
    if profile["is_drought_affected"]:
        eligible.append("drought_relief")
    
    # Flood Relief: Flood affected
    if profile["is_flood_affected"]:
        eligible.append("flood_relief")
    
    # Women Farmer Schemes
    if profile["gender"] == "female":
        eligible.append("mahila_kisan")
    
    # SC/ST schemes
    if profile["category"] in ["sc", "st"]:
        eligible.append("scst_farmer_scheme")
    
    return eligible


def generate_all_profiles(count: int = 300) -> List[Dict[str, Any]]:
    """Generate specified number of synthetic profiles."""
    random.seed(42)  # For reproducibility
    return [generate_profile(i + 1) for i in range(count)]


def save_profiles(profiles: List[Dict[str, Any]], filepath: str):
    """Save profiles to JSON file."""
    with open(filepath, 'w') as f:
        json.dump(profiles, f, indent=2)


if __name__ == "__main__":
    profiles = generate_all_profiles(300)
    save_profiles(profiles, "synthetic_profiles.json")
    
    # Print statistics
    print(f"Generated {len(profiles)} profiles")
    print(f"States covered: {len(set(p['state'] for p in profiles))}")
    print(f"Average acreage: {sum(p['acreage'] for p in profiles) / len(profiles):.2f}")
    print(f"Female farmers: {sum(1 for p in profiles if p['gender'] == 'female')}")
    print(f"Small farmers (<=2 ha): {sum(1 for p in profiles if p['acreage'] <= 2)}")
