from typing import List

# Deterministic list of agricultural villages in Punjab and Haryana
# Used for explainable risk ranking demonstration.
SYNTHETIC_VILLAGES: List[dict] = [
    # Punjab - Sangrur cluster (near DEMO-FIRE-2026-001 & 002)
    {
        "id": "DEMO-VILL-PB-01",
        "name": "Khurana",
        "district": "Sangrur",
        "state": "Punjab",
        "latitude": 30.2412,
        "longitude": 75.8395,
    },
    {
        "id": "DEMO-VILL-PB-02",
        "name": "Bhawanigarh",
        "district": "Sangrur",
        "state": "Punjab",
        "latitude": 30.2784,
        "longitude": 75.9221,
    },
    # Punjab - Firozpur (near DEMO-FIRE-2026-003)
    {
        "id": "DEMO-VILL-PB-03",
        "name": "Zira Rural",
        "district": "Firozpur",
        "state": "Punjab",
        "latitude": 30.9312,
        "longitude": 74.6245,
    },
    # Punjab - Tarn Taran (near DEMO-FIRE-2026-004)
    {
        "id": "DEMO-VILL-PB-04",
        "name": "Patti Rural",
        "district": "Tarn Taran",
        "state": "Punjab",
        "latitude": 31.4489,
        "longitude": 74.9284,
    },
    # Punjab - Bathinda (near DEMO-FIRE-2026-005)
    {
        "id": "DEMO-VILL-PB-05",
        "name": "Talwandi Sabo",
        "district": "Bathinda",
        "state": "Punjab",
        "latitude": 30.2089,
        "longitude": 74.9612,
    },
    # Punjab - Patiala (near DEMO-FIRE-2026-006)
    {
        "id": "DEMO-VILL-PB-06",
        "name": "Nabha Rural",
        "district": "Patiala",
        "state": "Punjab",
        "latitude": 30.3489,
        "longitude": 76.3752,
    },
    # Punjab - Amritsar (near DEMO-FIRE-2026-007)
    {
        "id": "DEMO-VILL-PB-07",
        "name": "Jandiala Guru",
        "district": "Amritsar",
        "state": "Punjab",
        "latitude": 31.6254,
        "longitude": 74.8812,
    },
    # Punjab - Ludhiana (near DEMO-FIRE-2026-008)
    {
        "id": "DEMO-VILL-PB-08",
        "name": "Ghudani Kalan",
        "district": "Ludhiana",
        "state": "Punjab",
        "latitude": 30.8921,
        "longitude": 75.8456,
    },
    # Punjab - Moga (near DEMO-FIRE-2026-009)
    {
        "id": "DEMO-VILL-PB-09",
        "name": "Baghapurana",
        "district": "Moga",
        "state": "Punjab",
        "latitude": 30.8198,
        "longitude": 75.1812,
    },
    # Punjab - Mansa (near DEMO-FIRE-2026-010)
    {
        "id": "DEMO-VILL-PB-10",
        "name": "Budhlada",
        "district": "Mansa",
        "state": "Punjab",
        "latitude": 29.9812,
        "longitude": 75.3984,
    },
    # Punjab - Rupnagar (No nearby fires - Low Risk test case)
    {
        "id": "DEMO-VILL-PB-11",
        "name": "Rupnagar Rural",
        "district": "Rupnagar",
        "state": "Punjab",
        "latitude": 30.9754,
        "longitude": 76.5251,
    },
    # Punjab - Hoshiarpur (No nearby fires - Low Risk test case)
    {
        "id": "DEMO-VILL-PB-12",
        "name": "Hoshiarpur North",
        "district": "Hoshiarpur",
        "state": "Punjab",
        "latitude": 31.5321,
        "longitude": 75.9142,
    },
    # Haryana - Kaithal (near DEMO-FIRE-2026-011)
    {
        "id": "DEMO-VILL-HR-01",
        "name": "Kalayat",
        "district": "Kaithal",
        "state": "Haryana",
        "latitude": 29.8089,
        "longitude": 76.3981,
    },
    {
        "id": "DEMO-VILL-HR-02",
        "name": "Cheeka",
        "district": "Kaithal",
        "state": "Haryana",
        "latitude": 29.8512,
        "longitude": 76.4321,
    },
    # Haryana - Karnal (near DEMO-FIRE-2026-012)
    {
        "id": "DEMO-VILL-HR-03",
        "name": "Nilokheri",
        "district": "Karnal",
        "state": "Haryana",
        "latitude": 29.6821,
        "longitude": 76.9745,
    },
    # Haryana - Fatehabad (near DEMO-FIRE-2026-013)
    {
        "id": "DEMO-VILL-HR-04",
        "name": "Tohana",
        "district": "Fatehabad",
        "state": "Haryana",
        "latitude": 29.5189,
        "longitude": 75.4612,
    },
    # Haryana - Jind (near DEMO-FIRE-2026-014)
    {
        "id": "DEMO-VILL-HR-05",
        "name": "Narwana",
        "district": "Jind",
        "state": "Haryana",
        "latitude": 29.3245,
        "longitude": 76.3156,
    },
    # Haryana - Kurukshetra (near DEMO-FIRE-2026-015)
    {
        "id": "DEMO-VILL-HR-06",
        "name": "Pehowa",
        "district": "Kurukshetra",
        "state": "Haryana",
        "latitude": 29.9745,
        "longitude": 76.8856,
    },
    # Haryana - Sirsa (near DEMO-FIRE-2026-016)
    {
        "id": "DEMO-VILL-HR-07",
        "name": "Ellenabad",
        "district": "Sirsa",
        "state": "Haryana",
        "latitude": 29.5289,
        "longitude": 75.0412,
    },
    # Haryana - Panchkula (No nearby fires - Low Risk test case)
    {
        "id": "DEMO-VILL-HR-08",
        "name": "Morni Foothills",
        "district": "Panchkula",
        "state": "Haryana",
        "latitude": 30.6945,
        "longitude": 76.8621,
    },
]
