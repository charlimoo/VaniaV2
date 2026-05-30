from django.test import SimpleTestCase

from vania_core.models import PageTutorial, normalize_tutorial_path


class PageTutorialPathMatchingTests(SimpleTestCase):
    def test_normalizes_plain_paths_and_full_urls(self):
        self.assertEqual(normalize_tutorial_path("dashboard/patients"), "/dashboard/patients")
        self.assertEqual(normalize_tutorial_path("/dashboard/patients/"), "/dashboard/patients")
        self.assertEqual(
            normalize_tutorial_path("https://panel.vaniaapp.app/dashboard/patients?tab=x"),
            "/dashboard/patients",
        )

    def test_exact_match_does_not_match_child_pages(self):
        tutorial = PageTutorial(page_path="/dashboard/doctors", normalized_path="/dashboard/doctors")

        self.assertTrue(tutorial.matches_path("/dashboard/doctors"))
        self.assertFalse(tutorial.matches_path("/dashboard/doctors/find"))

    def test_prefix_match_supports_dynamic_agent_threads(self):
        tutorial = PageTutorial(
            page_path="/chat/tashkil-parvande/",
            normalized_path="/chat/tashkil-parvande",
            match_prefix=True,
        )

        self.assertTrue(tutorial.matches_path("/chat/tashkil-parvande/local-534df647-3b31-45af-9e87-a89e48324cdb"))
        self.assertTrue(tutorial.matches_path("https://panel.vaniaapp.app/chat/tashkil-parvande/local-thread"))
        self.assertFalse(tutorial.matches_path("/chat/tashkil-parvande-other/local-thread"))
