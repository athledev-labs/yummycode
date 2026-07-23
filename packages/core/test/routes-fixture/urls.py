from django.urls import path

urlpatterns = [
    path('cats/', views.cats),
    path('dogs/', views.dogs),
]
