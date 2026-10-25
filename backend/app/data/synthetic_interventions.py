from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session

from app.models.intervention import (
    FieldVerificationModel,
    InterventionAuditModel,
    InterventionModel,
)

# Reference timestamp for deterministic seeding (aligned with project reference 2026-10-25)
BASE_TIME = datetime(2026, 10, 25, 10, 0, 0)


def seed_initial_interventions(db: Session) -> int:
    """Idempotently seed five deterministic synthetic interventions if the table is empty.

    Returns the number of seeded intervention records (5 if seeded, 0 if already populated).
    """
    existing_count = db.query(InterventionModel).count()
    if existing_count > 0:
        return 0

    # 1. INT-2026-PB-001: Completed + Field-Verified (Khurana, Sangrur)
    int_1 = InterventionModel(
        id="INT-2026-PB-001",
        village_id="DEMO-VILL-PB-01",
        village_name="Khurana",
        district="Sangrur",
        state="Punjab",
        equipment_id="DEMO-EQ-001",
        equipment_name="Turbo Happy Seeder #04",
        intervention_type="In-situ Happy Seeding",
        target_acres=45.0,
        status="Completed",
        completion_status="Field-Verified",
        created_at=BASE_TIME - timedelta(days=2, hours=4),
        updated_at=BASE_TIME - timedelta(hours=18),
        notes="High-priority in-situ seeding across North block farmland clusters to address nearby active burn hotspots.",
        is_synthetic=True,
    )
    db.add(int_1)

    audits_1: List[InterventionAuditModel] = [
        InterventionAuditModel(
            intervention_id=int_1.id,
            from_status="None",
            to_status="Proposed",
            changed_by="Cooperative Society Secretary M. Dhillon",
            reason="Initial intervention requisition submitted following satellite fire proximity alert.",
            timestamp=BASE_TIME - timedelta(days=2, hours=4),
        ),
        InterventionAuditModel(
            intervention_id=int_1.id,
            from_status="Proposed",
            to_status="Approved",
            changed_by="District Nodal Officer H. Singh (Sangrur)",
            reason="Approved subsidized Happy Seeder dispatch from Sangrur Central CHC.",
            timestamp=BASE_TIME - timedelta(days=1, hours=22),
        ),
        InterventionAuditModel(
            intervention_id=int_1.id,
            from_status="Approved",
            to_status="In Progress",
            changed_by="CHC Dispatch Coordinator (Sangrur Hub)",
            reason="Machinery mobilized and operational on 45 acres of paddy residue.",
            timestamp=BASE_TIME - timedelta(days=1, hours=10),
        ),
        InterventionAuditModel(
            intervention_id=int_1.id,
            from_status="In Progress",
            to_status="Completed",
            changed_by="Lead Farmer J. Singh (Khurana)",
            reason="Paddy straw chopped and wheat sown; self-reported job completion.",
            timestamp=BASE_TIME - timedelta(hours=22),
        ),
        InterventionAuditModel(
            intervention_id=int_1.id,
            from_status="Completed",
            to_status="Completed",
            changed_by="Nodal Field Officer S. Sandhu (Sangrur)",
            reason="Ground spot audit conducted. Field-Verified as completely cleared without residue incineration.",
            timestamp=BASE_TIME - timedelta(hours=18),
        ),
    ]
    db.add_all(audits_1)

    verif_1 = FieldVerificationModel(
        intervention_id=int_1.id,
        verifier_name="Nodal Field Officer S. Sandhu (Sangrur)",
        verified_at=BASE_TIME - timedelta(hours=18),
        outcome="Verified Cleared",
        verified_acres=45.0,
        evidence_metadata={
            "inspection_lat": 30.2315,
            "inspection_lon": 75.8340,
            "device_id": "DEMO-TAB-04",
            "satellite_anomaly_cleared": True,
            "method": "GPS-tagged walking transect inspection",
            "is_synthetic": True,
        },
        verification_notes="Synthetic ground audit confirmed zero active burns or smoldering. Paddy residue incorporated into soil bed using Happy Seeder.",
        is_synthetic=True,
    )
    db.add(verif_1)

    # 2. INT-2026-PB-002: Completed + Self-Reported (Bhawanigarh, Sangrur)
    int_2 = InterventionModel(
        id="INT-2026-PB-002",
        village_id="DEMO-VILL-PB-02",
        village_name="Bhawanigarh",
        district="Sangrur",
        state="Punjab",
        equipment_id="DEMO-EQ-002",
        equipment_name="High-Density Square Baler #02",
        intervention_type="Ex-situ Baler Collection",
        target_acres=60.0,
        status="Completed",
        completion_status="Self-Reported",
        created_at=BASE_TIME - timedelta(days=2),
        updated_at=BASE_TIME - timedelta(hours=6),
        notes="Baler aggregation for supplying biomass pellets to local industrial processing facility.",
        is_synthetic=True,
    )
    db.add(int_2)

    audits_2: List[InterventionAuditModel] = [
        InterventionAuditModel(
            intervention_id=int_2.id,
            from_status="None",
            to_status="Proposed",
            changed_by="Farmer Producer Organization (Sangrur)",
            reason="Requisition for commercial ex-situ straw baling.",
            timestamp=BASE_TIME - timedelta(days=2),
        ),
        InterventionAuditModel(
            intervention_id=int_2.id,
            from_status="Proposed",
            to_status="Approved",
            changed_by="District Nodal Officer H. Singh (Sangrur)",
            reason="Approved with biomass supply off-take agreement.",
            timestamp=BASE_TIME - timedelta(days=1, hours=16),
        ),
        InterventionAuditModel(
            intervention_id=int_2.id,
            from_status="Approved",
            to_status="In Progress",
            changed_by="Baler Operator (Sangrur CHC)",
            reason="Square baling commenced across contiguous farmlands.",
            timestamp=BASE_TIME - timedelta(days=1),
        ),
        InterventionAuditModel(
            intervention_id=int_2.id,
            from_status="In Progress",
            to_status="Completed",
            changed_by="Farmer Representative K. Gill",
            reason="All 60 acres baled into round bundles. Self-reported awaiting official verification.",
            timestamp=BASE_TIME - timedelta(hours=6),
        ),
    ]
    db.add_all(audits_2)

    # 3. INT-2026-PB-003: In Progress (Dirba, Sangrur)
    int_3 = InterventionModel(
        id="INT-2026-PB-003",
        village_id="DEMO-VILL-PB-03",
        village_name="Dirba",
        district="Sangrur",
        state="Punjab",
        equipment_id="DEMO-EQ-003",
        equipment_name="Super SMS Combine Attachment #01",
        intervention_type="In-situ Mulching",
        target_acres=35.0,
        status="In Progress",
        completion_status="Pending",
        created_at=BASE_TIME - timedelta(days=1, hours=12),
        updated_at=BASE_TIME - timedelta(hours=4),
        notes="Combine harvesting with Super SMS active to disperse loose straw evenly.",
        is_synthetic=True,
    )
    db.add(int_3)

    audits_3: List[InterventionAuditModel] = [
        InterventionAuditModel(
            intervention_id=int_3.id,
            from_status="None",
            to_status="Proposed",
            changed_by="Gram Panchayat Agriculture Committee",
            reason="Proposed Super SMS installation for collective harvesting.",
            timestamp=BASE_TIME - timedelta(days=1, hours=12),
        ),
        InterventionAuditModel(
            intervention_id=int_3.id,
            from_status="Proposed",
            to_status="Approved",
            changed_by="District Nodal Officer H. Singh (Sangrur)",
            reason="Approved operational subsidy.",
            timestamp=BASE_TIME - timedelta(days=1, hours=2),
        ),
        InterventionAuditModel(
            intervention_id=int_3.id,
            from_status="Approved",
            to_status="In Progress",
            changed_by="Sunam Hub Coordinator",
            reason="Harvester equipped with SMS working in field sector 3.",
            timestamp=BASE_TIME - timedelta(hours=4),
        ),
    ]
    db.add_all(audits_3)

    # 4. INT-2026-HR-004: Approved (Nilokheri, Karnal, Haryana)
    int_4 = InterventionModel(
        id="INT-2026-HR-004",
        village_id="DEMO-VILL-HR-01",
        village_name="Nilokheri",
        district="Karnal",
        state="Haryana",
        equipment_id="DEMO-EQ-011",
        equipment_name="Paddy Straw Baler Unit #07",
        intervention_type="Ex-situ Baler Collection",
        target_acres=50.0,
        status="Approved",
        completion_status="Pending",
        created_at=BASE_TIME - timedelta(days=1),
        updated_at=BASE_TIME - timedelta(hours=8),
        notes="Residue aggregation coordinated for supply to Panipat 2G ethanol plant.",
        is_synthetic=True,
    )
    db.add(int_4)

    audits_4: List[InterventionAuditModel] = [
        InterventionAuditModel(
            intervention_id=int_4.id,
            from_status="None",
            to_status="Proposed",
            changed_by="Cooperative Society (Nilokheri)",
            reason="Requisition for baler deployment under state bio-energy framework.",
            timestamp=BASE_TIME - timedelta(days=1),
        ),
        InterventionAuditModel(
            intervention_id=int_4.id,
            from_status="Proposed",
            to_status="Approved",
            changed_by="Sub-Divisional Agriculture Officer R. Verma (Karnal)",
            reason="Approved allocation from Karnal Central CHC.",
            timestamp=BASE_TIME - timedelta(hours=8),
        ),
    ]
    db.add_all(audits_4)

    # 5. INT-2026-HR-005: Proposed (Taraori, Karnal, Haryana)
    int_5 = InterventionModel(
        id="INT-2026-HR-005",
        village_id="DEMO-VILL-HR-02",
        village_name="Taraori",
        district="Karnal",
        state="Haryana",
        equipment_id="DEMO-EQ-012",
        equipment_name="Turbo Mulcher #06",
        intervention_type="In-situ Mulching",
        target_acres=25.0,
        status="Proposed",
        completion_status="Pending",
        created_at=BASE_TIME - timedelta(hours=14),
        updated_at=BASE_TIME - timedelta(hours=14),
        notes="Pre-emptive mulcher requisition following harvest of basmati rice crops.",
        is_synthetic=True,
    )
    db.add(int_5)

    audits_5: List[InterventionAuditModel] = [
        InterventionAuditModel(
            intervention_id=int_5.id,
            from_status="None",
            to_status="Proposed",
            changed_by="Village Farmer Lead G. Singh (Taraori)",
            reason="Submitted requisition for in-situ residue mulching.",
            timestamp=BASE_TIME - timedelta(hours=14),
        ),
    ]
    db.add_all(audits_5)

    db.commit()
    return 5
