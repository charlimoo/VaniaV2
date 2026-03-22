from .common import build_specialty_agent


AGENTS = [
    build_specialty_agent(
        slug="expert-psychologist-assistant",
        name="دستیار متخصص روانشناسی",
        description="دستیار فضای کاری روانشناسان برای مدیریت پرونده، تحلیل، طراحی درمان و جلسات در بوم تخصصی وانیا.",
        tags=["روانشناس", "داشبورد"],
        profession_slug="psychologist",
        profession_name="psychologist",
        source_modules=[
            "tashkil-parvande",
            "ravansanj",
            "tarahi-darman",
            "tarahi-jalasat-darman",
            "tarahi-jalasat-ravan-darman",
        ],
    ),
    build_specialty_agent(
        slug="expert-psychiatrist-assistant",
        name="دستیار متخصص روانپزشکی",
        description="دستیار فضای کاری روانپزشکان برای مدیریت پرونده، ارزیابی، طراحی درمان و جلسات دارودرمانی در بوم تخصصی وانیا.",
        tags=["روانپزشک", "داشبورد"],
        profession_slug="psychiatrist",
        profession_name="psychiatrist",
        source_modules=[
            "tashkil-parvande",
            "ravansanj",
            "tarahi-darman",
            "tarahi-jalasat-darman",
            "tarahi-jalasat-daro-darman",
        ],
    ),
    build_specialty_agent(
        slug="expert-lawyer-assistant",
        name="دستیار متخصص حقوقی",
        description="دستیار فضای کاری وکلا برای مدیریت پرونده و مستندات حقوقی در بوم تخصصی وانیا.",
        tags=["حقوقی", "داشبورد"],
        profession_slug="lawyer",
        profession_name="lawyer",
        source_modules=["vakil"],
    ),
    build_specialty_agent(
        slug="expert-general-doctor-assistant",
        name="دستیار متخصص پزشک عمومی",
        description="دستیار فضای کاری پزشکان عمومی برای مدیریت پرونده، شرح حال و ثبت بررسی‌ها در بوم تخصصی وانیا.",
        tags=["پزشک عمومی", "داشبورد"],
        profession_slug="general_doctor",
        profession_name="general doctor",
        source_modules=["general-doctor"],
    ),
]
