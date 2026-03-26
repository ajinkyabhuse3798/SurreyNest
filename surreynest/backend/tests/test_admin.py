"""Tests for admin stats and user management."""


def test_overview_stats_counts_all_users(
    client, test_user, test_admin, admin_token
):
    """Overview stats should count all registered users."""
    response = client.get(
        "/api/admin/stats/overview",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total_users"] == 2
    assert data["registered_users"] == 2
    assert data["guest_users"] == 0


def test_admin_cannot_set_guest_role(client, db, test_user, admin_token):
    """Guest role is no longer valid — should return 400."""
    response = client.patch(
        f"/api/admin/users/{test_user.id}",
        json={"role": "guest"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 400
    assert "Invalid role" in response.json()["detail"]


def test_admin_can_update_user_role_to_landlord(client, db, test_user, admin_token):
    """Admin should be able to set a valid role like landlord."""
    response = client.patch(
        f"/api/admin/users/{test_user.id}",
        json={"role": "landlord"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200
    assert response.json()["role"] == "landlord"

    db.refresh(test_user)
    assert test_user.role == "landlord"
