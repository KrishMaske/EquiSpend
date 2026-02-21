from config.settings import supabase

def get_all_cities():
    try:
        response = supabase.table('numbeo_scrape').select('city').execute()
        print("Response data:", response.data)
        print("Response count:", len(response.data) if response.data else 0)
    except Exception as e:
        print("Error fetching cities:", e)
        return []
    return response.data