import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface DesignMeasurementAttributes {
  id: number;
  design_id: number;
  measurement_type_id: number;
  is_required?: boolean;
  created_at?: Date;
}

interface DesignMeasurementCreationAttributes extends Optional<DesignMeasurementAttributes, 'id' | 'created_at'> {}

class DesignMeasurement extends Model<DesignMeasurementAttributes, DesignMeasurementCreationAttributes> implements DesignMeasurementAttributes {
  public id!: number;
  public design_id!: number;
  public measurement_type_id!: number;
  public is_required?: boolean;
  public created_at?: Date;
}

DesignMeasurement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    design_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'designs',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    measurement_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'measurement_types',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    is_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'design_measurements',
    timestamps: false,
    indexes: [
      {
        fields: ['design_id'],
      },
      {
        unique: true,
        fields: ['design_id', 'measurement_type_id'],
      },
    ],
  }
);

export default DesignMeasurement;