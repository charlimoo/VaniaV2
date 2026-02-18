import re
import requests
from bs4 import BeautifulSoup

def is_loose_match(input_name, scraped_name):
    """
    Fuzzy matching for Persian names.
    """
    def clean(text):
        if not text: return ""
        # Normalization
        text = text.replace("ي", "ی").replace("ك", "ک")
        # Remove honorifics
        text = re.sub(r"(دکتر|سید|سیده|آقای|خانم)\s+", "", text)
        # Normalize whitespace
        text = re.sub(r"\s+", " ", text).strip()
        return text

    name1 = clean(input_name)
    name2 = clean(scraped_name)

    if len(name1) < 3: return False
    if name1 == name2: return True

    input_words = [w for w in name1.split(" ") if len(w) > 1]
    system_words = [w for w in name2.split(" ") if len(w) > 1]

    if not input_words: return False

    match_count = 0
    for word in input_words:
        if any(sw == word or sw.startswith(word) for sw in system_words):
            match_count += 1

    return (match_count / len(input_words)) >= 0.7

def verify_doctor_license(full_name, license_code):
    """
    Scrapes pcoiran.ir to verify doctor credentials.
    Includes a backdoor for '123456'.
    """
    if not license_code or not full_name:
        return False, "نام و کد عضویت الزامی است", None

    # --- BACKDOOR FOR TESTING ---
    if str(license_code) == "123456":
        return True, "تایید شد", full_name
    # ----------------------------

    url = f"https://my.pcoiran.ir/member/?mem_id={license_code}"
    
    # Headers to mimic a browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
    }

    try:
        # Note: verify=False is used because Iranian gov/org sites often have SSL issues.
        response = requests.get(url, headers=headers, verify=False, timeout=10)
        
        if response.status_code != 200:
            return False, "عدم پاسخگویی سامانه", None

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Adjust selector based on actual site structure. 
        title_tag = soup.select_one('.card-title')
        
        if not title_tag:
            return False, "عضوی با این کد یافت نشد", None

        found_name = title_tag.get_text(strip=True)
        is_valid = is_loose_match(full_name, found_name)
        
        if is_valid:
            return True, "تایید شد", found_name
        else:
            return False, "نام وارد شده با اطلاعات سامانه مطابقت ندارد", found_name

    except Exception as e:
        print(f"Verification Error: {e}")
        return False, "خطا در برقراری ارتباط با سامانه", None