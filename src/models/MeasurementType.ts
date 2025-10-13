import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface MeasurementTypeAttributes {
  id: number;
  name: string;
  description?: string;
  freesewing_key?: string;
  created_at?: Date;
}

interface MeasurementTypeCreationAttributes extends Optional<MeasurementTypeAttributes, 'id' | 'created_at'> {}

class MeasurementType extends Model<MeasurementTypeAttributes, MeasurementTypeCreationAttributes> implements MeasurementTypeAttributes {
  public id!: number;
  public name!: string;
  public description?: string;
  public freesewing_key?: string;
  public created_at?: Date;
}

MeasurementType.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    freesewing_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'measurement_types',
    timestamps: false,
  }
);

export default MeasurementType;