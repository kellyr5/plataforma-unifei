from rest_framework import serializers
from forum.models import Disciplina


class DisciplinaSerializer(serializers.ModelSerializer):
    """Serializa o model Disciplina para JSON e vice-versa."""

    class Meta:
        model = Disciplina
        fields = [
            'id',
            'codigo',
            'nome',
            'curso',
            'semestre',
            'ativo',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
